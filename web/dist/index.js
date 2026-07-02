// web/src/index.js
import { configureWeb } from "@adobedjangir/commerce-admin-management/web";

// web/src/SnapshotHistory.js
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  ProgressCircle,
  StatusLight,
  Well,
  DialogTrigger,
  Dialog,
  Content,
  Header,
  ButtonGroup,
  Divider,
  Switch,
  Checkbox,
  Picker,
  Item
} from "@adobe/react-spectrum";
import { callAction, resolveActor } from "@adobedjangir/commerce-admin-management/web";
import { getActionKey, getUserRoleProvider } from "@adobedjangir/commerce-admin-management/web";
import { PALETTE, RADIUS, SHADOW } from "@adobedjangir/commerce-admin-management/web";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var PAGE_SIZE_OPTIONS = [
  { id: "25", label: "25 / page" },
  { id: "50", label: "50 / page" },
  { id: "100", label: "100 / page" }
];
function SnapshotHistory({ runtime, ims }) {
  var _a, _b, _c, _d;
  const useRole = getUserRoleProvider();
  const { role: userRole } = useRole({ runtime, ims });
  const isAdmin = (userRole || "admin") === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({ tone: "neutral", message: "" });
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [restoreSchema, setRestoreSchema] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => /* @__PURE__ */ new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [returned, setReturned] = useState(0);
  const fetchPage = useCallback(async (nextPage = 0, sizeOverride = null) => {
    var _a2;
    const size = sizeOverride || pageSize;
    setLoading(true);
    setError(null);
    try {
      const res = await callAction({ runtime, ims }, getActionKey("systemConfigSnapshotList"), "", { limit: size, skip: nextPage * size });
      const body = (res == null ? void 0 : res.body) || res;
      const next = Array.isArray(body == null ? void 0 : body.items) ? body.items : [];
      setItems(next);
      setReturned((_a2 = body == null ? void 0 : body.returned) != null ? _a2 : next.length);
      setPage(nextPage);
      setSelectedIds(/* @__PURE__ */ new Set());
    } catch (e) {
      setError(e.message || "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }, [runtime, ims, pageSize]);
  const fetchList = useCallback(() => fetchPage(0), [fetchPage]);
  useEffect(() => {
    fetchPage(0);
  }, []);
  const hasPrev = page > 0;
  const hasNext = returned >= pageSize;
  const onChangePageSize = (next) => {
    const n = Number(next) || 25;
    setPageSize(n);
    fetchPage(0, n);
  };
  const doCreate = async () => {
    setCreating(true);
    setStatus({ tone: "notice", message: "Creating snapshot\u2026" });
    try {
      const res = await callAction({ runtime, ims }, getActionKey("systemConfigSnapshotCreate"), "", {
        label: newLabel.trim() || void 0,
        actor: resolveActor(ims)
      });
      const body = (res == null ? void 0 : res.body) || res;
      if (body == null ? void 0 : body.ok) {
        setStatus({ tone: "positive", message: `Snapshot saved: ${body.snapshot.label}` });
        setNewLabel("");
        await fetchList();
      } else {
        setStatus({ tone: "negative", message: (body == null ? void 0 : body.error) || "Snapshot failed" });
      }
    } catch (e) {
      setStatus({ tone: "negative", message: e.message || "Snapshot failed" });
    } finally {
      setCreating(false);
    }
  };
  const doRestore = async () => {
    if (!confirmRow) return;
    setRestoring(true);
    setStatus({ tone: "notice", message: "Restoring\u2026" });
    try {
      const res = await callAction({ runtime, ims }, getActionKey("systemConfigSnapshotRestore"), "", {
        snapshotId: confirmRow._id,
        restoreSchema,
        actor: resolveActor(ims)
      });
      const body = (res == null ? void 0 : res.body) || res;
      if (body == null ? void 0 : body.ok) {
        setStatus({
          tone: "positive",
          message: `Restored from ${confirmRow.label}. Pre-restore backup saved as ${body.preRestoreSnapshot}.`
        });
        await fetchList();
      } else {
        setStatus({ tone: "negative", message: (body == null ? void 0 : body.error) || "Restore failed" });
      }
    } catch (e) {
      setStatus({ tone: "negative", message: e.message || "Restore failed" });
    } finally {
      setRestoring(false);
      setConfirmRow(null);
    }
  };
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const allVisibleSelected = items.length > 0 && items.every((r) => selectedIds.has(r._id));
  const toggleSelectAll = () => setSelectedIds(() => allVisibleSelected ? /* @__PURE__ */ new Set() : new Set(items.map((r) => r._id)));
  const runDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    setDeleting(true);
    setStatus({ tone: "notice", message: `Deleting ${ids.length} snapshot${ids.length === 1 ? "" : "s"}\u2026` });
    try {
      const res = await callAction({ runtime, ims }, getActionKey("systemConfigSnapshotDelete"), "", { ids });
      const body = (res == null ? void 0 : res.body) || res;
      if (body == null ? void 0 : body.ok) {
        setStatus({ tone: "positive", message: `Deleted ${body.deleted} of ${body.requested}` });
        setSelectedIds(/* @__PURE__ */ new Set());
        await fetchList();
      } else {
        setStatus({ tone: "negative", message: (body == null ? void 0 : body.error) || "Delete failed" });
      }
    } catch (e) {
      setStatus({ tone: "negative", message: e.message || "Delete failed" });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };
  const GRID = isAdmin ? "40px minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 180px" : "minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 120px";
  return /* @__PURE__ */ jsxs(View, { padding: "size-400", UNSAFE_style: { background: PALETTE.bg, minHeight: "100vh" }, children: [
    /* @__PURE__ */ jsx(Heading, { level: 2, marginTop: 0, children: "Snapshots" }),
    /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.textMuted }, children: "Each snapshot captures the entire schema + every value row. Restore replays a snapshot wholesale \u2014 the current state is automatically backed up first so a restore is itself reversible." }),
    status.message && /* @__PURE__ */ jsx(View, { marginTop: "size-150", children: /* @__PURE__ */ jsx(StatusLight, { variant: status.tone, children: status.message }) }),
    error && /* @__PURE__ */ jsx(Well, { marginTop: "size-150", UNSAFE_style: { borderColor: PALETTE.danger }, children: /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.danger }, children: error }) }),
    /* @__PURE__ */ jsx(
      View,
      {
        marginTop: "size-200",
        padding: "size-200",
        UNSAFE_style: { background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs },
        children: /* @__PURE__ */ jsxs(Flex, { gap: "size-150", alignItems: "end", wrap: true, children: [
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Snapshot label (optional)",
              value: newLabel,
              onChange: setNewLabel,
              width: "size-4600",
              placeholder: "e.g. before-2026-Q2-release"
            }
          ),
          /* @__PURE__ */ jsx(Button, { variant: "cta", onPress: doCreate, isDisabled: !isAdmin || creating || loading, children: creating ? "Saving\u2026" : !isAdmin ? "Admin only" : "Save snapshot now" }),
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: fetchList, isDisabled: loading, children: "Reload" })
        ] })
      }
    ),
    /* @__PURE__ */ jsxs(
      View,
      {
        marginTop: "size-200",
        UNSAFE_style: { background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs, overflow: "hidden" },
        children: [
          /* @__PURE__ */ jsx(View, { paddingX: "size-200", paddingY: "size-150", UNSAFE_style: { background: PALETTE.surfaceMuted, borderBottom: `1px solid ${PALETTE.border}` }, children: /* @__PURE__ */ jsxs(Flex, { gap: "size-200", alignItems: "center", justifyContent: "space-between", wrap: true, children: [
            /* @__PURE__ */ jsxs(Flex, { gap: "size-150", alignItems: "center", wrap: true, children: [
              /* @__PURE__ */ jsx(Picker, { "aria-label": "Rows per page", selectedKey: String(pageSize), onSelectionChange: onChangePageSize, width: "size-1700", isDisabled: loading, children: PAGE_SIZE_OPTIONS.map((o) => /* @__PURE__ */ jsx(Item, { children: o.label }, o.id)) }),
              /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.textMuted, fontSize: 12 }, children: items.length === 0 ? "No rows" : /* @__PURE__ */ jsxs(Fragment, { children: [
                "Page ",
                /* @__PURE__ */ jsx("strong", { children: page + 1 }),
                " \xB7 rows ",
                page * pageSize + 1,
                "\u2013",
                page * pageSize + returned
              ] }) })
            ] }),
            /* @__PURE__ */ jsxs(Flex, { gap: "size-100", children: [
              /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => hasPrev && fetchPage(page - 1), isDisabled: !hasPrev || loading, children: "\u2190 Prev" }),
              /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => hasNext && fetchPage(page + 1), isDisabled: !hasNext || loading, children: "Next \u2192" })
            ] })
          ] }) }),
          isAdmin && selectedIds.size > 0 && /* @__PURE__ */ jsx(View, { paddingX: "size-200", paddingY: "size-100", UNSAFE_style: { background: PALETTE.surfaceMuted, borderBottom: `1px solid ${PALETTE.border}` }, children: /* @__PURE__ */ jsxs(Flex, { gap: "size-150", alignItems: "center", children: [
            /* @__PURE__ */ jsxs(Text, { UNSAFE_style: { fontSize: 12, fontWeight: 600 }, children: [
              selectedIds.size,
              " selected"
            ] }),
            /* @__PURE__ */ jsx(Button, { variant: "negative", onPress: () => setConfirmDelete({ ids: Array.from(selectedIds) }), isDisabled: deleting, children: "Delete selected" }),
            /* @__PURE__ */ jsx(Button, { variant: "secondary", isQuiet: true, onPress: () => setSelectedIds(/* @__PURE__ */ new Set()), isDisabled: deleting, children: "Clear" })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { style: {
            display: "grid",
            gridTemplateColumns: GRID,
            padding: "12px 16px",
            gap: 12,
            background: PALETTE.surfaceMuted,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: PALETTE.textMuted,
            borderBottom: `1px solid ${PALETTE.border}`
          }, children: [
            isAdmin && /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(Checkbox, { "aria-label": "Select all", isSelected: allVisibleSelected, onChange: toggleSelectAll, isDisabled: deleting }) }),
            /* @__PURE__ */ jsx("div", { children: "Label" }),
            /* @__PURE__ */ jsx("div", { children: "Created at" }),
            /* @__PURE__ */ jsx("div", { children: "Created by" }),
            /* @__PURE__ */ jsx("div", { children: "Values" }),
            /* @__PURE__ */ jsx("div", { children: "Sections" }),
            /* @__PURE__ */ jsx("div", { children: "Action" })
          ] }),
          loading && items.length === 0 ? /* @__PURE__ */ jsx(Flex, { justifyContent: "center", margin: "size-400", children: /* @__PURE__ */ jsx(ProgressCircle, { "aria-label": "Loading", isIndeterminate: true }) }) : items.length === 0 ? /* @__PURE__ */ jsx(View, { padding: "size-400", children: /* @__PURE__ */ jsx(Text, { UNSAFE_style: { color: PALETTE.textMuted }, children: "No snapshots yet." }) }) : items.map((row, i) => {
            var _a2, _b2, _c2, _d2;
            return /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: GRID,
                  padding: "12px 16px",
                  gap: 12,
                  borderBottom: `1px solid ${PALETTE.border}`,
                  fontSize: 13,
                  background: i % 2 === 0 ? PALETTE.surface : PALETTE.surfaceSubtle,
                  alignItems: "center"
                },
                children: [
                  isAdmin && /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(Checkbox, { "aria-label": "Select snapshot", isSelected: selectedIds.has(row._id), onChange: () => toggleSelect(row._id), isDisabled: deleting }) }),
                  /* @__PURE__ */ jsxs("div", { style: { wordBreak: "break-word" }, children: [
                    /* @__PURE__ */ jsx("div", { style: { fontWeight: 600 }, children: row.label }),
                    /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }, children: row._id })
                  ] }),
                  /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }, children: row.createdAt ? new Date(row.createdAt).toLocaleString() : "" }),
                  /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, wordBreak: "break-word" }, children: row.createdBy || "system" }),
                  /* @__PURE__ */ jsx("div", { children: (_b2 = (_a2 = row.counts) == null ? void 0 : _a2.values) != null ? _b2 : "?" }),
                  /* @__PURE__ */ jsx("div", { children: (_d2 = (_c2 = row.counts) == null ? void 0 : _c2.sections) != null ? _d2 : "?" }),
                  /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(Flex, { gap: "size-100", wrap: true, children: [
                    /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => setConfirmRow(row), isDisabled: restoring || !isAdmin, children: isAdmin ? "Restore" : "Admin only" }),
                    isAdmin && /* @__PURE__ */ jsx(Button, { variant: "negative", isQuiet: true, onPress: () => setConfirmDelete({ ids: [row._id] }), isDisabled: deleting, children: "Delete" })
                  ] }) })
                ]
              },
              row._id
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(DialogTrigger, { isOpen: !!confirmDelete, onOpenChange: (o) => {
      if (!o) setConfirmDelete(null);
    }, children: [
      /* @__PURE__ */ jsx("div", { style: { display: "none" }, "aria-hidden": "true", children: "trigger" }),
      /* @__PURE__ */ jsxs(Dialog, { children: [
        /* @__PURE__ */ jsxs(Heading, { children: [
          "Delete ",
          confirmDelete && confirmDelete.ids.length === 1 ? "snapshot" : "snapshots",
          "?"
        ] }),
        /* @__PURE__ */ jsx(Divider, {}),
        /* @__PURE__ */ jsx(Content, { children: /* @__PURE__ */ jsxs(Text, { children: [
          "Permanently delete ",
          /* @__PURE__ */ jsx("strong", { children: confirmDelete ? confirmDelete.ids.length : 0 }),
          " snapshot",
          confirmDelete && confirmDelete.ids.length === 1 ? "" : "s",
          "? This can't be undone."
        ] }) }),
        /* @__PURE__ */ jsxs(ButtonGroup, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => setConfirmDelete(null), isDisabled: deleting, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { variant: "negative", onPress: () => runDelete(confirmDelete.ids), isDisabled: deleting, children: deleting ? "Deleting\u2026" : "Delete" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(DialogTrigger, { isOpen: !!confirmRow, onOpenChange: (o) => {
      if (!o) setConfirmRow(null);
    }, children: [
      /* @__PURE__ */ jsx("div", { style: { display: "none" }, "aria-hidden": "true", children: "trigger" }),
      /* @__PURE__ */ jsxs(Dialog, { children: [
        /* @__PURE__ */ jsx(Heading, { children: "Restore this snapshot?" }),
        /* @__PURE__ */ jsx(Header, { children: /* @__PURE__ */ jsx(Text, { children: confirmRow == null ? void 0 : confirmRow.label }) }),
        /* @__PURE__ */ jsx(Divider, {}),
        /* @__PURE__ */ jsxs(Content, { children: [
          /* @__PURE__ */ jsxs(Text, { children: [
            "The current state will be saved as a backup snapshot, then every value row will be replaced with the snapshot's contents.",
            " ",
            (_b = (_a = confirmRow == null ? void 0 : confirmRow.counts) == null ? void 0 : _a.values) != null ? _b : "?",
            " value rows and",
            " ",
            (_d = (_c = confirmRow == null ? void 0 : confirmRow.counts) == null ? void 0 : _c.sections) != null ? _d : "?",
            " schema sections."
          ] }),
          /* @__PURE__ */ jsx(View, { marginTop: "size-200", children: /* @__PURE__ */ jsx(Switch, { isSelected: restoreSchema, onChange: setRestoreSchema, children: "Restore schema too (uncheck to keep current schema, restore values only)" }) })
        ] }),
        /* @__PURE__ */ jsxs(ButtonGroup, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => setConfirmRow(null), isDisabled: restoring, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { variant: "cta", onPress: doRestore, isDisabled: restoring, children: restoring ? "Restoring\u2026" : "Restore" })
        ] })
      ] })
    ] })
  ] });
}

// web/src/index.js
function registerSnapshots() {
  configureWeb({
    actionKeys: {
      systemConfigSnapshotCreate: "Snapshots/system-config-snapshot-create",
      systemConfigSnapshotList: "Snapshots/system-config-snapshot-list",
      systemConfigSnapshotRestore: "Snapshots/system-config-snapshot-restore",
      systemConfigSnapshotDelete: "Snapshots/system-config-snapshot-delete"
    },
    extraNav: [{
      id: "snapshots",
      path: "/snapshots",
      label: "Snapshots",
      icon: "Box",
      parentId: "system"
    }],
    extraPages: { snapshots: SnapshotHistory }
  });
}
export {
  SnapshotHistory,
  registerSnapshots as default
};
