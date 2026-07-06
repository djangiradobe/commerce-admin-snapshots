/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Snapshot history viewer + restore UI. Snapshots are written by either:
//   - the create action (user clicks "Save snapshot now")
//   - the restore action (an auto pre-restore snapshot is taken first)

import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Flex, Heading, Text, Button, TextField, ProgressCircle,
  StatusLight, Well, DialogTrigger, Dialog, Content, Header, ButtonGroup,
  Divider, Switch, Checkbox, Picker, Item
} from '@adobe/react-spectrum'

const PAGE_SIZE_OPTIONS = [
  { id: '25', label: '25 / page' },
  { id: '50', label: '50 / page' },
  { id: '100', label: '100 / page' }
]
import { callAction, resolveActor } from '@adobedjangir/commerce-admin-management/web'
import { getActionKey, getUserRoleProvider } from '@adobedjangir/commerce-admin-management/web'
import { PALETTE, RADIUS, SHADOW } from '@adobedjangir/commerce-admin-management/web'

export default function SnapshotHistory ({ runtime, ims }) {
  // Create + restore are admin-only (restore is destructive); everyone can view.
  const useRole = getUserRoleProvider()
  const { role: userRole } = useRole({ runtime, ims })
  const isAdmin = (userRole || 'admin') === 'admin'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState({ tone: 'neutral', message: '' })
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmRow, setConfirmRow] = useState(null)
  const [restoreSchema, setRestoreSchema] = useState(true)
  const [restoring, setRestoring] = useState(false)

  // Delete (single + multi-select) state. Admin-only.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { ids: [...] } | null

  // Pagination.
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [returned, setReturned] = useState(0)

  // Fetch one page. skip = page * size; the action returns { items, returned }.
  // `returned < size` ⇒ this is the last page.
  const fetchPage = useCallback(async (nextPage = 0, sizeOverride = null) => {
    const size = sizeOverride || pageSize
    setLoading(true); setError(null)
    try {
      const res = await callAction({ runtime, ims }, getActionKey('systemConfigSnapshotList'), '', { limit: size, skip: nextPage * size })
      const body = res?.body || res
      const next = Array.isArray(body?.items) ? body.items : []
      setItems(next)
      setReturned(body?.returned ?? next.length)
      setPage(nextPage)
      setSelectedIds(new Set()) // clear selection when the page changes
    } catch (e) {
      setError(e.message || 'Failed to load snapshots')
    } finally {
      setLoading(false)
    }
  }, [runtime, ims, pageSize])

  // Back-compat alias — callers that just want a refresh land on page 0.
  const fetchList = useCallback(() => fetchPage(0), [fetchPage])

  useEffect(() => { fetchPage(0) /* initial load */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasPrev = page > 0
  const hasNext = returned >= pageSize
  const onChangePageSize = (next) => {
    const n = Number(next) || 25
    setPageSize(n)
    fetchPage(0, n)
  }

  const doCreate = async () => {
    setCreating(true); setStatus({ tone: 'notice', message: 'Creating snapshot…' })
    try {
      const res = await callAction({ runtime, ims }, getActionKey('systemConfigSnapshotCreate'), '', {
        label: newLabel.trim() || undefined,
        actor: resolveActor(ims)
      })
      const body = res?.body || res
      if (body?.ok) {
        setStatus({ tone: 'positive', message: `Snapshot saved: ${body.snapshot.label}` })
        setNewLabel('')
        await fetchList()
      } else {
        setStatus({ tone: 'negative', message: body?.error || 'Snapshot failed' })
      }
    } catch (e) {
      setStatus({ tone: 'negative', message: e.message || 'Snapshot failed' })
    } finally {
      setCreating(false)
    }
  }

  const doRestore = async () => {
    if (!confirmRow) return
    setRestoring(true)
    setStatus({ tone: 'notice', message: 'Restoring…' })
    try {
      const res = await callAction({ runtime, ims }, getActionKey('systemConfigSnapshotRestore'), '', {
        snapshotId: confirmRow._id,
        restoreSchema,
        actor: resolveActor(ims)
      })
      const body = res?.body || res
      if (body?.ok) {
        setStatus({
          tone: 'positive',
          message: `Restored from ${confirmRow.label}. Pre-restore backup saved as ${body.preRestoreSnapshot}.`
        })
        await fetchList()
      } else {
        setStatus({ tone: 'negative', message: body?.error || 'Restore failed' })
      }
    } catch (e) {
      setStatus({ tone: 'negative', message: e.message || 'Restore failed' })
    } finally {
      setRestoring(false)
      setConfirmRow(null)
    }
  }

  // ── Delete (admin-only) ──
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allVisibleSelected = items.length > 0 && items.every((r) => selectedIds.has(r._id))
  const toggleSelectAll = () => setSelectedIds(() => (allVisibleSelected ? new Set() : new Set(items.map((r) => r._id))))

  const runDelete = async (ids) => {
    if (!ids || ids.length === 0) return
    setDeleting(true)
    setStatus({ tone: 'notice', message: `Deleting ${ids.length} snapshot${ids.length === 1 ? '' : 's'}…` })
    try {
      const res = await callAction({ runtime, ims }, getActionKey('systemConfigSnapshotDelete'), '', { ids })
      const body = res?.body || res
      if (body?.ok) {
        setStatus({ tone: 'positive', message: `Deleted ${body.deleted} of ${body.requested}` })
        setSelectedIds(new Set())
        await fetchList()
      } else {
        setStatus({ tone: 'negative', message: body?.error || 'Delete failed' })
      }
    } catch (e) {
      setStatus({ tone: 'negative', message: e.message || 'Delete failed' })
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  // Grid columns — admins get a leading checkbox + wider Action column.
  const GRID = isAdmin
    ? '40px minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 180px'
    : 'minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 120px'

  return (
    <View padding="size-400" UNSAFE_style={{ background: PALETTE.bg, minHeight: '100vh' }}>
      <Heading level={2} marginTop={0}>Snapshots</Heading>
      <Text UNSAFE_style={{ color: PALETTE.textMuted }}>
        Each snapshot captures the entire schema + every value row. Restore
        replays a snapshot wholesale — the current state is automatically
        backed up first so a restore is itself reversible.
      </Text>

      {status.message && (
        <View marginTop="size-150"><StatusLight variant={status.tone}>{status.message}</StatusLight></View>
      )}
      {error && (
        <Well marginTop="size-150" UNSAFE_style={{ borderColor: PALETTE.danger }}>
          <Text UNSAFE_style={{ color: PALETTE.danger }}>{error}</Text>
        </Well>
      )}

      <View
        marginTop="size-200"
        padding="size-200"
        UNSAFE_style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs }}
      >
        <Flex gap="size-150" alignItems="end" wrap>
          <TextField
            label="Snapshot label (optional)"
            value={newLabel}
            onChange={setNewLabel}
            width="size-4600"
            placeholder="e.g. before-2026-Q2-release"
          />
          <Button variant="cta" onPress={doCreate} isDisabled={!isAdmin || creating || loading}>
            {creating ? 'Saving…' : (!isAdmin ? 'Admin only' : 'Save snapshot now')}
          </Button>
          <Button variant="secondary" onPress={fetchList} isDisabled={loading}>
            Reload
          </Button>
        </Flex>
      </View>

      <View
        marginTop="size-200"
        UNSAFE_style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs, overflow: 'hidden' }}
      >
        {/* Pagination bar. */}
        <View paddingX="size-200" paddingY="size-150" UNSAFE_style={{ background: PALETTE.surfaceMuted, borderBottom: `1px solid ${PALETTE.border}` }}>
          <Flex gap="size-200" alignItems="center" justifyContent="space-between" wrap>
            <Flex gap="size-150" alignItems="center" wrap>
              <Picker aria-label="Rows per page" selectedKey={String(pageSize)} onSelectionChange={onChangePageSize} width="size-1700" isDisabled={loading}>
                {PAGE_SIZE_OPTIONS.map((o) => <Item key={o.id}>{o.label}</Item>)}
              </Picker>
              <Text UNSAFE_style={{ color: PALETTE.textMuted, fontSize: 12 }}>
                {items.length === 0 ? 'No rows' : <>Page <strong>{page + 1}</strong> · rows {page * pageSize + 1}–{page * pageSize + returned}</>}
              </Text>
            </Flex>
            <Flex gap="size-100">
              <Button variant="secondary" onPress={() => hasPrev && fetchPage(page - 1)} isDisabled={!hasPrev || loading}>← Prev</Button>
              <Button variant="secondary" onPress={() => hasNext && fetchPage(page + 1)} isDisabled={!hasNext || loading}>Next →</Button>
            </Flex>
          </Flex>
        </View>

        {/* Bulk-delete bar — admin-only, shown when snapshots are selected. */}
        {isAdmin && selectedIds.size > 0 && (
          <View paddingX="size-200" paddingY="size-100" UNSAFE_style={{ background: PALETTE.surfaceMuted, borderBottom: `1px solid ${PALETTE.border}` }}>
            <Flex gap="size-150" alignItems="center">
              <Text UNSAFE_style={{ fontSize: 12, fontWeight: 600 }}>{selectedIds.size} selected</Text>
              <Button variant="negative" onPress={() => setConfirmDelete({ ids: Array.from(selectedIds) })} isDisabled={deleting}>Delete selected</Button>
              <Button variant="secondary" isQuiet onPress={() => setSelectedIds(new Set())} isDisabled={deleting}>Clear</Button>
            </Flex>
          </View>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          padding: '12px 16px',
          gap: 12,
          background: PALETTE.surfaceMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: PALETTE.textMuted,
          borderBottom: `1px solid ${PALETTE.border}`
        }}>
          {isAdmin && (<div><Checkbox aria-label="Select all" isSelected={allVisibleSelected} onChange={toggleSelectAll} isDisabled={deleting} /></div>)}
          <div>Label</div>
          <div>Created at</div>
          <div>Created by</div>
          <div>Values</div>
          <div>Sections</div>
          <div>Action</div>
        </div>
        {loading && items.length === 0 ? (
          <Flex justifyContent="center" margin="size-400"><ProgressCircle aria-label="Loading" isIndeterminate /></Flex>
        ) : items.length === 0 ? (
          <View padding="size-400"><Text UNSAFE_style={{ color: PALETTE.textMuted }}>No snapshots yet.</Text></View>
        ) : (
          items.map((row, i) => (
            <div
              key={row._id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                padding: '12px 16px',
                gap: 12,
                borderBottom: `1px solid ${PALETTE.border}`,
                fontSize: 13,
                background: i % 2 === 0 ? PALETTE.surface : PALETTE.surfaceSubtle,
                alignItems: 'center'
              }}
            >
              {isAdmin && (<div><Checkbox aria-label="Select snapshot" isSelected={selectedIds.has(row._id)} onChange={() => toggleSelect(row._id)} isDisabled={deleting} /></div>)}
              <div style={{ wordBreak: 'break-word' }}>
                <div style={{ fontWeight: 600 }}>{row.label}</div>
                <div style={{ color: PALETTE.textMuted, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{row._id}</div>
              </div>
              <div style={{ color: PALETTE.textMuted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
              </div>
              <div style={{ color: PALETTE.textMuted, wordBreak: 'break-word' }}>{row.createdBy || 'system'}</div>
              <div>{row.counts?.values ?? '?'}</div>
              <div>{row.counts?.sections ?? '?'}</div>
              <div>
                <Flex gap="size-100" wrap>
                  <Button variant="secondary" onPress={() => setConfirmRow(row)} isDisabled={restoring || !isAdmin}>
                    {isAdmin ? 'Restore' : 'Admin only'}
                  </Button>
                  {isAdmin && (
                    <Button variant="negative" isQuiet onPress={() => setConfirmDelete({ ids: [row._id] })} isDisabled={deleting}>
                      Delete
                    </Button>
                  )}
                </Flex>
              </div>
            </div>
          ))
        )}
      </View>

      {/* Delete confirmation (single or selected). */}
      <DialogTrigger isOpen={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
        <div style={{ display: 'none' }} aria-hidden="true">trigger</div>
        <Dialog>
          <Heading>Delete {confirmDelete && confirmDelete.ids.length === 1 ? 'snapshot' : 'snapshots'}?</Heading>
          <Divider />
          <Content>
            <Text>
              Permanently delete <strong>{confirmDelete ? confirmDelete.ids.length : 0}</strong> snapshot
              {confirmDelete && confirmDelete.ids.length === 1 ? '' : 's'}? This can't be undone.
            </Text>
          </Content>
          <ButtonGroup>
            <Button variant="secondary" onPress={() => setConfirmDelete(null)} isDisabled={deleting}>Cancel</Button>
            <Button variant="negative" onPress={() => runDelete(confirmDelete.ids)} isDisabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </ButtonGroup>
        </Dialog>
      </DialogTrigger>

      <DialogTrigger isOpen={!!confirmRow} onOpenChange={(o) => { if (!o) setConfirmRow(null) }}>
        <div style={{ display: 'none' }} aria-hidden="true">trigger</div>
        <Dialog>
          <Heading>Restore this snapshot?</Heading>
          <Header><Text>{confirmRow?.label}</Text></Header>
          <Divider />
          <Content>
            <Text>
              The current state will be saved as a backup snapshot, then every
              value row will be replaced with the snapshot's contents.
              {' '}{confirmRow?.counts?.values ?? '?'} value rows and
              {' '}{confirmRow?.counts?.sections ?? '?'} schema sections.
            </Text>
            <View marginTop="size-200">
              <Switch isSelected={restoreSchema} onChange={setRestoreSchema}>
                Restore schema too (uncheck to keep current schema, restore values only)
              </Switch>
            </View>
          </Content>
          <ButtonGroup>
            <Button variant="secondary" onPress={() => setConfirmRow(null)} isDisabled={restoring}>Cancel</Button>
            <Button variant="cta" onPress={doRestore} isDisabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          </ButtonGroup>
        </Dialog>
      </DialogTrigger>
    </View>
  )
}
