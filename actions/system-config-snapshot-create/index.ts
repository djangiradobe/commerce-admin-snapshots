/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Capture a point-in-time snapshot of system_config_data into the
// system_config_snapshots collection. The snapshot is a single document
// that contains the entire schema + all value rows, so restore is a clean
// replay (no merge logic). Sensitive values stay encrypted on the way in.

const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('@adobedjangir/commerce-admin-management/actions/utils')
const { getClient } = require('@adobedjangir/commerce-admin-management/abdb')

// Soft RBAC hook — creating snapshots is admin-only (literal require so
// esbuild bundles it; see core system-config-save for the rationale).
let rbacHook = null
try { rbacHook = require('@adobedjangir/commerce-admin-ims-access/hook') } catch (_) { rbacHook = null }

const DATA_COLLECTION = 'system_config_data'
const SCHEMA_COLLECTION = 'system_config_schema'
const SCHEMA_DOC_ID = 'v1'
const SNAPSHOT_COLLECTION = 'system_config_snapshots'
const SNAPSHOT_MAX = 100

// Per-cold-start guard so we createIndex at most once per container.
let snapIndexEnsured = false

async function ensureCollection (client, name) {
  try { await client.createCollection(name) } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err)
    if (!/exist|already|duplicate/i.test(msg)) throw err
  }
}

async function tryFindOne (col, query) {
  try {
    const arr = await col.find(query).limit(1).toArray()
    return arr && arr.length ? arr[0] : null
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err)
    if (/not found/i.test(msg)) return null
    throw err
  }
}

async function main (params) {
  const logger = Core.Logger('system-config-snapshot-create', { level: params.LOG_LEVEL || 'info' })
  if (rbacHook && rbacHook.assertMinRole) {
    let roleErr = null
    try { roleErr = await rbacHook.assertMinRole(params, 'admin') } catch (_) { roleErr = null }
    if (roleErr) return { statusCode: 403, body: { error: roleErr } }
  }
  const label = (params.label && String(params.label).trim()) || `Snapshot ${new Date().toISOString()}`
  const createdBy = (params.actor && String(params.actor)) ||
    (params.__ow_headers && (params.__ow_headers['x-gw-ims-org-id'] || params.__ow_headers['x-ims-org-id'])) ||
    'system'

  let handle
  try {
    handle = await getClient(params)
  } catch (e) {
    return errorResponse(500, `ABDB connect failed: ${e.message}`, logger)
  }
  const { client, close } = handle

  try {
    await ensureCollection(client, SNAPSHOT_COLLECTION)
    const snapColForIndex = await client.collection(SNAPSHOT_COLLECTION)
    if (!snapIndexEnsured) {
      try { await snapColForIndex.createIndex({ createdAt: -1 }); snapIndexEnsured = true } catch (_) { /* best-effort */ }
    }
    const dataCol = await client.collection(DATA_COLLECTION)
    const schemaCol = await client.collection(SCHEMA_COLLECTION)
    const snapCol = await client.collection(SNAPSHOT_COLLECTION)

    const [valueDocs, schemaDoc] = await Promise.all([
      dataCol.find({}).toArray().catch(() => []),
      tryFindOne(schemaCol, { _id: SCHEMA_DOC_ID })
    ])

    const now = new Date().toISOString()
    const snapshot = {
      _id: `snap_${now.replace(/[:.]/g, '-')}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      createdBy,
      label,
      schema: schemaDoc && schemaDoc.schema ? schemaDoc.schema : null,
      values: valueDocs.map((d) => ({
        scope: d.scope,
        scope_id: d.scope_id,
        path: d.path,
        value: d.value
      })),
      counts: {
        values: valueDocs.length,
        sections: schemaDoc && schemaDoc.schema ? (schemaDoc.schema.sections || []).length : 0
      }
    }
    await snapCol.insertOne(snapshot)

    // Compact older snapshots — keep only the most recent SNAPSHOT_MAX. Use
    // estimatedDocumentCount (O(1) metadata) and project only _id when finding
    // the ones to drop (snapshot docs are large — don't pull their payloads).
    try {
      const total = await (snapCol.estimatedDocumentCount ? snapCol.estimatedDocumentCount() : snapCol.countDocuments({}))
      if (total > SNAPSHOT_MAX) {
        const over = total - SNAPSHOT_MAX
        const oldest = await snapCol.find({}, { projection: { _id: 1 } }).sort({ createdAt: 1 }).limit(over).toArray()
        for (const o of oldest) await snapCol.deleteOne({ _id: o._id })
      }
    } catch (_) { /* compaction best-effort */ }

    logger.info(`Snapshot ${snapshot._id} created (${snapshot.counts.values} values)`)
    return {
      statusCode: 200,
      body: { ok: true, snapshot: { _id: snapshot._id, label, createdAt: now, createdBy, counts: snapshot.counts } }
    }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, error.message || 'snapshot create failed', logger)
  } finally {
    try { await close() } catch (_) {}
  }
}

export { main }
