"use strict";
/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
// Delete one or more snapshots by _id. Admin-only (destructive). Accepts a
// single `id` or `ids` (array) — powers per-row delete and "delete selected".
// Snapshot _ids are explicit strings (snap_…), so matching is straightforward.
const { Core } = require('@adobe/aio-sdk');
const { errorResponse } = require('@adobedjangir/commerce-admin-management/actions/utils');
const { getClient } = require('@adobedjangir/commerce-admin-management/abdb');
// Soft RBAC hook — deleting snapshots is admin-only.
let rbacHook = null;
try {
    rbacHook = require('@adobedjangir/commerce-admin-ims-access/hook');
}
catch (_) {
    rbacHook = null;
}
const SNAPSHOT_COLLECTION = 'system_config_snapshots';
function normalizeIds(params) {
    if (Array.isArray(params.ids))
        return params.ids.map((x) => String(x)).filter(Boolean);
    if (params.id != null && String(params.id).trim())
        return [String(params.id).trim()];
    return [];
}
async function main(params) {
    const logger = Core.Logger('system-config-snapshot-delete', { level: params.LOG_LEVEL || 'info' });
    if (rbacHook && rbacHook.assertMinRole) {
        let roleErr = null;
        try {
            roleErr = await rbacHook.assertMinRole(params, 'admin');
        }
        catch (_) {
            roleErr = null;
        }
        if (roleErr)
            return { statusCode: 403, body: { ok: false, error: roleErr } };
    }
    const ids = normalizeIds(params);
    if (ids.length === 0)
        return { statusCode: 400, body: { ok: false, error: 'Provide id or ids to delete.' } };
    let handle;
    try {
        handle = await getClient(params);
    }
    catch (e) {
        return errorResponse(500, `ABDB connect failed: ${e.message}`, logger);
    }
    const { client, close } = handle;
    try {
        const col = await client.collection(SNAPSHOT_COLLECTION);
        let deleted = 0;
        try {
            const res = await col.deleteMany({ _id: { $in: ids } });
            deleted = (res && (res.deletedCount ?? res.deleted)) || 0;
        }
        catch (_) {
            for (const id of ids) {
                try {
                    const r = await col.deleteOne({ _id: id });
                    deleted += (r && (r.deletedCount ?? r.deleted)) || 0;
                }
                catch (_) { }
            }
        }
        return { statusCode: 200, body: { ok: true, requested: ids.length, deleted } };
    }
    catch (error) {
        logger.error(error);
        return errorResponse(500, error.message || 'snapshot delete failed', logger);
    }
    finally {
        try {
            await close();
        }
        catch (_) { }
    }
}
exports.main = main;
