# @adobedjangir/commerce-admin-snapshots

Snapshot + rollback add-on for
[`@adobedjangir/commerce-admin-management`](https://www.npmjs.com/package/@adobedjangir/commerce-admin-management).

Capture point-in-time copies of the **entire** system config (schema + every
value row) and restore them wholesale — with an automatic pre-restore backup.

---

## What it adds

| Piece | Where |
|---|---|
| **Snapshots** page | System nav — create snapshots, view history, restore |
| `system-config-snapshot-create` action | Captures schema + all value rows into one snapshot doc |
| `system-config-snapshot-list` action | Lists snapshots (newest first) with counts |
| `system-config-snapshot-restore` action | Restores a snapshot (auto-backs up current state first) |

## Restore safety

- Restoring **replaces** the current schema + values with the snapshot's.
- A **pre-restore snapshot** is captured automatically first, so a restore is
  itself undoable.

> **Create, restore, and delete are admin-only** (delete supports single + multi-select) when the
> [`ims-access`](https://www.npmjs.com/package/@adobedjangir/commerce-admin-ims-access)
> RBAC add-on is installed (restore is destructive). Viewing history is open to
> all roles. Without RBAC, create/restore are open.

---

## Install

```bash
npm install @adobedjangir/commerce-admin-snapshots
aio app deploy
```

`npm install` auto-registers the tab + actions via the core discovery mechanism.
**`aio app deploy` is required** to deploy the `Snapshots` action package (and,
when RBAC is installed, to bundle the role hook that gates create/restore).

## Notes

- A snapshot stores the schema doc plus a copy of every `system_config_data`
  row, so it's a complete, self-contained restore point.
- Encrypted (sensitive) values are snapshotted as stored (still encrypted).

## License

Apache-2.0
