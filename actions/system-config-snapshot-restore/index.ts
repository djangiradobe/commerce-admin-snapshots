/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Restore the entire system_config_data collection from a snapshot.
// Strategy: write a snapshot of the CURRENT state first (so the restore
// itself is auditable + reversible), then wipe + repopulate.
//
// Sensitive values in the snapshot are stored as ciphertext (we never
// decrypt at snapshot time), so restore replays them verbatim — they
// remain readable as long as SYSTEM_CONFIG_CRYPT_KEY hasn't changed
// between snapshot and restore.

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, checkMissingRequestInputs } = require('@adobedjangir/commerce-admin-management/actions/utils')
const { getClient } = require('@adobedjangir/commerce-admin-management/abdb')
const { toStateKey } = require('@adobedjangir/commerce-admin-management/shared')

// Soft RBAC hook — restoring a snapshot is destructive → admin-only.
let rbacHook = null
try { rbacHook = require('@adobedjangir/commerce-admin-ims-access/hook') } catch (_) { rbacHook = null }

const DATA_COLLECTION = 'system_config_data'
const SCHEMA_COLLECTION = 'system_config_schema'
const SCHEMA_DOC_ID = 'v1'
const SNAPSHOT_COLLECTION = 'system_config_snapshots'
const AUDIT_COLLECTION = 'system_config_audit'

async function ensureCollection (client, name) {
  try { await client.createCollection(name) } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err)
    if (!/exist|already|duplicate/i.test(msg)) throw err
  }
}

async function main (params) {
  const logger = Core.Logger('system-config-snapshot-restore', { level: params.LOG_LEVEL || 'info' })
  if (rbacHook && rbacHook.assertMinRole) {
    let roleErr = null
    try { roleErr = await rbacHook.assertMinRole(params, 'admin') } catch (_) { roleErr = null }
    if (roleErr) return errorResponse(403, roleErr, logger)
  }
  const missing = checkMissingRequestInputs(params, ['snapshotId'], [])
  if (missing) return errorResponse(400, missing, logger)
  const snapshotId = String(params.snapshotId)
  const actor = (params.actor && String(params.actor)) || 'system'
  const restoreSchema = params.restoreSchema !== false && params.restoreSchema !== 'false'

  let handle
  try { handle = await getClient(params) } catch (e) {
    return errorResponse(500, `ABDB connect failed: ${e.message}`, logger)
  }
  const { client, close } = handle

  try {
    const snapCol = await client.collection(SNAPSHOT_COLLECTION)
    const snap = await (async () => {
      try { return await snapCol.findOne({ _id: snapshotId }) }
      catch { return null }
    })()
    if (!snap) return errorResponse(404, `Snapshot ${snapshotId} not found`, logger)

    // 1) Capture a "pre-restore" snapshot of the current state so this op is
    //    reversible. Inline rather than reusing the create action.
    const dataCol = await client.collection(DATA_COLLECTION)
    const schemaCol = await client.collection(SCHEMA_COLLECTION)
    const now = new Date().toISOString()
    const currentValues = await dataCol.find({}).toArray().catch(() => [])
    const currentSchemaDoc = await (async () => {
      try { return await schemaCol.findOne({ _id: SCHEMA_DOC_ID }) }
      catch { return null }
    })()
    const preRestoreSnap = {
      _id: `snap_${now.replace(/[:.]/g, '-')}_pre-restore`,
      createdAt: now,
      createdBy: actor,
      label: `Auto: pre-restore of ${snap.label || snapshotId}`,
      schema: currentSchemaDoc && currentSchemaDoc.schema ? currentSchemaDoc.schema : null,
      values: currentValues.map((d) => ({ scope: d.scope, scope_id: d.scope_id, path: d.path, value: d.value })),
      counts: {
        values: currentValues.length,
        sections: currentSchemaDoc && currentSchemaDoc.schema ? (currentSchemaDoc.schema.sections || []).length : 0
      }
    }
    try { await snapCol.insertOne(preRestoreSnap) } catch (e) {
      logger.warn(`pre-restore snapshot failed (continuing): ${e.message}`)
    }

    // 2) Replace schema if the snapshot has one and the caller wants it.
    if (restoreSchema && snap.schema) {
      try {
        await schemaCol.updateOne(
          { _id: SCHEMA_DOC_ID },
          { $set: { schema: snap.schema, updatedAt: now }, $setOnInsert: { _id: SCHEMA_DOC_ID, createdAt: now } },
          { upsert: true }
        )
      } catch (e) {
        // Fallback for drivers without upsert.
        if (currentSchemaDoc) await schemaCol.updateOne({ _id: SCHEMA_DOC_ID }, { $set: { schema: snap.schema, updatedAt: now } })
        else await schemaCol.insertOne({ _id: SCHEMA_DOC_ID, schema: snap.schema, createdAt: now, updatedAt: now })
      }
    }

    // 3) Wipe data collection then bulk-insert the snapshot's values.
    for (const d of currentValues) {
      await dataCol.deleteOne({ _id: d._id })
    }
    let inserted = 0
    for (const v of (snap.values || [])) {
      try {
        const id = toStateKey(v.scope, v.scope_id, v.path)
        await dataCol.insertOne({
          _id: id,
          scope: v.scope,
          scope_id: v.scope_id,
          path: v.path,
          value: v.value,
          createdAt: now,
          updatedAt: now
        })
        inserted++
      } catch (e) {
        logger.warn(`failed to restore ${v.path} at ${v.scope}:${v.scope_id}: ${e.message}`)
      }
    }

    // 4) Audit row for the restore action — a single high-level entry.
    try {
      await ensureCollection(client, AUDIT_COLLECTION)
      const auditCol = await client.collection(AUDIT_COLLECTION)
      await auditCol.insertOne({
        scope: 'default',
        scope_id: '0',
        path: '_system/snapshot/restore',
        action: 'update',
        oldValue: `pre:${preRestoreSnap._id}`,
        newValue: `from:${snapshotId}`,
        changedBy: actor,
        changedAt: now
      })
    } catch (_) {}

    logger.info(`Restored snapshot ${snapshotId}: deleted ${currentValues.length}, inserted ${inserted}`)
    return {
      statusCode: 200,
      body: {
        ok: true,
        restoredFrom: snapshotId,
        preRestoreSnapshot: preRestoreSnap._id,
        deleted: currentValues.length,
        inserted
      }
    }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, error.message || 'snapshot restore failed', logger)
  } finally {
    try { await close() } catch (_) {}
  }
}

export { main }
