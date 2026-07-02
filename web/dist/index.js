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
  Switch
} from "@adobe/react-spectrum";
import { callAction, resolveActor } from "@adobedjangir/commerce-admin-management/web";
import { getActionKey, getUserRoleProvider } from "@adobedjangir/commerce-admin-management/web";
import { PALETTE, RADIUS, SHADOW } from "@adobedjangir/commerce-admin-management/web";
import { jsx, jsxs } from "react/jsx-runtime";
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
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callAction({ runtime, ims }, getActionKey("systemConfigSnapshotList"), "", { limit: 100 });
      const body = (res == null ? void 0 : res.body) || res;
      setItems(Array.isArray(body == null ? void 0 : body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }, [runtime, ims]);
  useEffect(() => {
    fetchList();
  }, [fetchList]);
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
          /* @__PURE__ */ jsxs("div", { style: {
            display: "grid",
            gridTemplateColumns: "minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 120px",
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
                  gridTemplateColumns: "minmax(180px, 1fr) minmax(140px, 200px) minmax(160px, 220px) 110px 110px 120px",
                  padding: "12px 16px",
                  gap: 12,
                  borderBottom: `1px solid ${PALETTE.border}`,
                  fontSize: 13,
                  background: i % 2 === 0 ? PALETTE.surface : PALETTE.surfaceSubtle,
                  alignItems: "center"
                },
                children: [
                  /* @__PURE__ */ jsxs("div", { style: { wordBreak: "break-word" }, children: [
                    /* @__PURE__ */ jsx("div", { style: { fontWeight: 600 }, children: row.label }),
                    /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }, children: row._id })
                  ] }),
                  /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }, children: row.createdAt ? new Date(row.createdAt).toLocaleString() : "" }),
                  /* @__PURE__ */ jsx("div", { style: { color: PALETTE.textMuted, wordBreak: "break-word" }, children: row.createdBy || "system" }),
                  /* @__PURE__ */ jsx("div", { children: (_b2 = (_a2 = row.counts) == null ? void 0 : _a2.values) != null ? _b2 : "?" }),
                  /* @__PURE__ */ jsx("div", { children: (_d2 = (_c2 = row.counts) == null ? void 0 : _c2.sections) != null ? _d2 : "?" }),
                  /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(Button, { variant: "secondary", onPress: () => setConfirmRow(row), isDisabled: restoring || !isAdmin, children: isAdmin ? "Restore" : "Admin only" }) })
                ]
              },
              row._id
            );
          })
        ]
      }
    ),
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
      systemConfigSnapshotRestore: "Snapshots/system-config-snapshot-restore"
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
