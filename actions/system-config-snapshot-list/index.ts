/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Paginated list of snapshots. Returns metadata only (label/createdAt/counts) —
// the full value array is omitted so the UI list stays light. The restore
// action loads the full doc on demand.

const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('@adobedjangir/commerce-admin-management/actions/utils')
const { getClient } = require('@adobedjangir/commerce-admin-management/abdb')

const SNAPSHOT_COLLECTION = 'system_config_snapshots'

// Per-cold-start guard so we createIndex at most once per container.
let snapIndexEnsured = false

async function main (params) {
  const logger = Core.Logger('system-config-snapshot-list', { level: params.LOG_LEVEL || 'info' })
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 500)
  const skip = Math.max(parseInt(params.skip, 10) || 0, 0)

  let handle
  try { handle = await getClient(params) } catch (e) {
    return errorResponse(500, `ABDB connect failed: ${e.message}`, logger)
  }
  const { client, close } = handle

  try {
    const col = await client.collection(SNAPSHOT_COLLECTION)
    if (!snapIndexEnsured) {
      try { await col.createIndex({ createdAt: -1 }); snapIndexEnsured = true } catch (_) { /* best-effort */ }
    }
    // Project OUT the heavy payloads (full schema + every value row) server-side
    // so the list never transfers them — the list only needs metadata + counts.
    // The app-side map below is kept as a fallback if the driver ignores the
    // projection option.
    const docs = await col.find({}, { projection: { schema: 0, values: 0 } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray().catch(() => [])
    // Strip large payloads from the list response.
    const items = docs.map((d) => ({
      _id: d._id,
      label: d.label,
      createdAt: d.createdAt,
      createdBy: d.createdBy,
      counts: d.counts
    }))
    return { statusCode: 200, body: { ok: true, items, limit, skip, returned: items.length } }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, error.message || 'snapshot list failed', logger)
  } finally {
    try { await close() } catch (_) {}
  }
}

export { main }
