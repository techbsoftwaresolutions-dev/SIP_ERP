import { useEffect, useState } from "react";
import { Pressable, Share, Switch, Text, View } from "react-native";
import api from "../../api/client";
import ListScreen from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, Icon, IconButton, KeyValueGrid, Loader, Note, SectionTitle, StatCard, StatGrid, StatusBadge, useFeedback, usePrimary } from "../../components/ui";
import { Input } from "../../components/forms";
import { useList } from "../../hooks/useRecord";
import { useLocation, useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

// Ports of pages/users/* — Users (+ invite), User form, Roles & Permissions,
// and the Audit Log.

// ---------------------------------------------------------------- Users
export function Users() {
  const { toast } = useFeedback();
  const [invite, setInvite] = useState(null);

  const sendInvite = async (row) => {
    if (!row.email) return toast("This user has no email address to send an invite to.");
    try {
      const res = await api.post(`/api/users/${encodeURIComponent(row.id)}/invite`, {});
      setInvite({ ...res, user: row });
    } catch (err) {
      toast(err.message || "Could not send that invitation.");
    }
  };

  return (
    <ListScreen
      title="Users"
      endpoint="/api/users"
      addPath="/users/new"
      editPath={(r) => `/users/${encodeURIComponent(r.id)}/edit`}
      header={
        invite ? (
          <Card style={{ backgroundColor: invite.emailed ? colors.greenBg : colors.amberBg, borderColor: "transparent" }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Icon name={invite.emailed ? "checkCircle" : "alertCircle"} color={invite.emailed ? colors.green : colors.amber} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: "700" }}>{invite.emailed ? `Invitation emailed to ${invite.user.email}` : `Invitation ready for ${invite.user.name}`}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {invite.emailed
                    ? "The link works once and expires in 48 hours."
                    : invite.smtpConfigured
                      ? `Email could not be sent (${invite.emailError}). Send this link to them yourself:`
                      : "No mail server is set up in Settings → Email, so send this link to them yourself:"}
                </Text>
                {!invite.emailed ? (
                  <>
                    <Text selectable style={{ fontSize: 12, color: colors.text }}>{invite.link}</Text>
                    <Button small variant="secondary" icon="share" title="Share link" onPress={() => Share.share({ message: invite.link })} style={{ alignSelf: "flex-start" }} />
                  </>
                ) : null}
              </View>
              <IconButton name="close" onPress={() => setInvite(null)} />
            </View>
          </Card>
        ) : null
      }
      card={(r) => ({
        title: r.name,
        subtitle: [r.role, r.email].filter(Boolean).join(" · "),
        meta: [{ icon: "clock", label: "Last login", text: r.lastLogin }],
        badges: r.invitePending ? ["Invite sent"] : [],
        status: r.status,
      })}
      rowActions={(r) => [{ label: r.hasPassword ? "Send password reset link" : "Send invitation", icon: "mail", onPress: () => sendInvite(r) }]}
    />
  );
}

export function UserForm() {
  const [roleNames, setRoleNames] = useState(["Administrator"]);
  useEffect(() => {
    api
      .get("/api/roles?page=1&pageSize=100")
      .then((r) => {
        const names = (r.data || []).map((x) => x.name).filter(Boolean);
        if (names.length) setRoleNames(names);
      })
      .catch(() => {});
  }, []);
  return (
    <RecordFormScreen
      entity="User"
      endpoint="/api/users"
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "Enter your name" },
        { key: "email", label: "Email", type: "email", required: true, placeholder: "Where their invitation is sent" },
        { key: "role", label: "Role", type: "select", options: roleNames },
      ]}
    />
  );
}

// ---------------------------------------------------------------- Roles
const ADMIN = "administrator";
const isAdminRole = (r) => r && String(r.name).toLowerCase() === ADMIN;

export function Roles() {
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState("");
  const [newRole, setNewRole] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = () =>
    api
      .get("/api/roles?page=1&pageSize=100")
      .then((r) => setRoles(r.data || []))
      .catch((err) => setError(err.message || "Could not load roles."));
  useEffect(() => {
    load();
  }, []);

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    try {
      await api.post("/api/roles", { name, permissions: [] });
      setNewRole("");
      toast(`Role "${name}" added.`);
      load();
    } catch (err) {
      setError(err.message || "Could not add that role.");
    }
  };

  const removeRole = async (r) => {
    if (!(await confirm({ title: "Delete this role?", message: `Delete "${r.name}"? Users still assigned to it will lose access until they are given another role.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.delete(`/api/roles/${encodeURIComponent(r.id)}`);
      toast("Role deleted.");
      load();
    } catch (err) {
      toast(err.message || "Could not delete that role.");
    }
  };

  return (
    <Screen title="Roles & Permissions" onRefresh={load}>
      <ErrorBox message={error} />
      {roles === null ? (
        <Loader />
      ) : roles.length === 0 ? (
        <Card>
          <SectionTitle>No roles yet</SectionTitle>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>While no roles exist, everyone has full access. Creating roles is what switches permission checks on.</Text>
          <Button
            title={seeding ? "Creating…" : "Create default roles"}
            loading={seeding}
            onPress={async () => {
              setSeeding(true);
              try {
                await api.post("/api/roles/seed-defaults", {});
                toast("Default roles created.");
                await load();
              } catch (err) {
                setError(err.message || "Could not create default roles.");
              } finally {
                setSeeding(false);
              }
            }}
          />
        </Card>
      ) : (
        <>
          {roles.map((r) => (
            <Card key={r.id} onPress={() => navigate("/users/roles/:id".replace(":id", encodeURIComponent(r.id)), { state: { role: r } })} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>{r.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{isAdminRole(r) ? "Full access" : `${(r.permissions || []).length} permissions`}</Text>
              </View>
              {!isAdminRole(r) ? <IconButton name="trash" color={colors.red} onPress={() => removeRole(r)} /> : null}
              <Icon name="chevronRight" color={colors.textLight} />
            </Card>
          ))}
          <Card style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Input value={newRole} onChangeText={setNewRole} placeholder="New role name" onSubmitEditing={addRole} />
            </View>
            <Button title="Add" onPress={addRole} disabled={!newRole.trim()} />
          </Card>
        </>
      )}
    </Screen>
  );
}

// Permission matrix for one role — one card per menu with a switch per action.
export function RolePermissions() {
  const { state } = useLocation();
  const { toast } = useFeedback();
  const primary = usePrimary();
  const [role, setRole] = useState(state && state.role ? state.role : null);
  const [catalogue, setCatalogue] = useState(null);
  const [draft, setDraft] = useState(new Set((state && state.role && state.role.permissions) || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/permissions/catalogue").then(setCatalogue).catch((err) => setError(err.message || "Could not load permissions."));
  }, []);

  if (!role) return <Screen title="Role"><ErrorBox message="Open a role from Roles & Permissions." /></Screen>;
  const admin = isAdminRole(role);
  const offers = (m, a) => !m.actions || m.actions.includes(a);
  const setKeys = (keys, on) => {
    if (admin) return;
    const next = new Set(draft);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    setDraft(next);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await api.put(`/api/roles/${encodeURIComponent(role.id)}`, { permissions: [...draft] });
      if (updated && updated.id) setRole(updated);
      toast("Permissions saved.");
    } catch (err) {
      setError(err.message || "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title={role.name}>
      {admin ? <Note icon="lock">Administrator always has every permission and can't be restricted — this is what guarantees you can never lock yourself out.</Note> : null}
      <ErrorBox message={error} />
      {!catalogue ? (
        <Loader />
      ) : (
        <>
          {!admin ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {catalogue.actions.map((a) => {
                const keys = catalogue.modules.filter((m) => offers(m, a)).map((m) => `${m.key}.${a}`);
                const all = keys.every((k) => draft.has(k));
                return <Button key={a} small variant="secondary" title={`${all ? "Clear" : "All"} ${a}`} onPress={() => setKeys(keys, !all)} />;
              })}
            </View>
          ) : null}
          {catalogue.modules.map((m) => {
            const rowKeys = catalogue.actions.filter((a) => offers(m, a)).map((a) => `${m.key}.${a}`);
            const allRow = rowKeys.every((k) => draft.has(k));
            return (
              <Card key={m.key} style={{ paddingVertical: 10 }}>
                <Pressable onPress={() => setKeys(rowKeys, !allRow)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ flex: 1, fontWeight: "700", color: m.parent ? colors.textMuted : colors.text, paddingLeft: m.parent ? 10 : 0 }}>{m.label}</Text>
                  {!admin ? <Text style={{ color: primary, fontSize: 12, fontWeight: "600" }}>{allRow ? "Clear row" : "All"}</Text> : null}
                </Pressable>
                <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4 }}>
                  {catalogue.actions.map((a) => {
                    const key = `${m.key}.${a}`;
                    if (!offers(m, a)) return null;
                    return (
                      <View key={a} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Switch value={admin || draft.has(key)} disabled={admin} onValueChange={(on) => setKeys([key], on)} trackColor={{ true: primary }} />
                        <Text style={{ textTransform: "capitalize", color: colors.text }}>{a}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })}
          {!admin ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(new Set(role.permissions || []))} />
              <Button title="Save Permissions" style={{ flex: 1 }} loading={saving} onPress={save} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------- Audit log
const FALLBACK_MODULES = ["Authentication", "Customers", "Suppliers", "Inventory", "Purchase", "Sales", "Invoices", "Reports", "Users & Roles", "Settings", "AI Assistant"];
const FALLBACK_ACTIONS = ["Login", "Logout", "Failed Login", "Create", "Update", "Delete", "Export", "Password Changed", "Role Changed", "User Updated", "User Deleted", "Company Settings Changed"];

function formatDateTime(row) {
  if (!row.createdAt) return row.date || "—";
  const d = new Date(row.createdAt);
  if (Number.isNaN(d.getTime())) return row.date || "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AuditLogs() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({});
  useEffect(() => {
    api.get("/api/activity-log/summary").then(setSummary).catch(() => {});
    api.get("/api/activity-log/filter-options").then((o) => setOptions(o || {})).catch(() => {});
  }, []);
  return (
    <ListScreen
      title="Audit Logs"
      endpoint="/api/activity-log"
      canAdd={false}
      onPressRow={(r) => navigate(`/users/audit-logs/${encodeURIComponent(r.id)}`, { state: { row: r } })}
      header={
        <StatGrid>
          <StatCard label="Total Logs" value={summary ? summary.total : "—"} />
          <StatCard label="User Actions" value={summary ? summary.userActions : "—"} color="teal" />
          <StatCard label="Security Events" value={summary ? summary.securityEvents : "—"} color="amber" />
          <StatCard label="Failed Attempts" value={summary ? summary.failedAttempts : "—"} color="red" />
        </StatGrid>
      }
      filters={[
        { key: "user", label: "User", options: options.users || [] },
        { key: "role", label: "Role", options: options.roles || [] },
        { key: "module", label: "Module", options: options.modules && options.modules.length ? options.modules : FALLBACK_MODULES },
        { key: "action", label: "Action", options: options.actions && options.actions.length ? options.actions : FALLBACK_ACTIONS },
        { key: "status", label: "Status", options: ["Success", "Failed", "Warning"] },
        { key: "dateFrom", label: "From", type: "date" },
        { key: "dateTo", label: "To", type: "date" },
      ]}
      card={(r) => ({
        title: `${r.action || "—"} · ${r.module || "—"}`,
        subtitle: `${r.user || "—"}${r.role ? ` (${r.role})` : ""} · ${formatDateTime(r)}`,
        meta: [{ text: r.description || r.details }, { icon: "globe", text: r.ip }, { text: r.location }],
        status: r.status || "Success",
        icon: r.action === "Login" || r.action === "Logout" || r.action === "Failed Login" ? "lock" : "file",
      })}
    />
  );
}

export function AuditLogDetail() {
  const { state } = useLocation();
  const row = state && state.row;
  if (!row) return <Screen title="Audit Log"><ErrorBox message="Open an entry from the Audit Logs list." /></Screen>;
  const keys = Array.from(new Set([...Object.keys(row.before || {}), ...Object.keys(row.after || {})]));
  const show = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <Screen title={row.id}>
      <Card>
        <KeyValueGrid
          rows={[
            ["Activity ID", row.id],
            ["Date & Time", formatDateTime(row)],
            ["User", row.user],
            ["Role", row.role],
            ["Action", row.action],
            ["Module", row.module],
            ["Status", <StatusBadge status={row.status || "Success"} />],
            ["Record", [row.entityType, row.entityId].filter(Boolean).join(" ")],
            ["IP Address", row.ip],
            ["Location", row.location],
            ["Device", row.device, { full: true }],
            ["Request", [row.method, row.path].filter(Boolean).join(" "), { full: true }],
            ["Description", row.description || row.details, { full: true }],
          ]}
        />
      </Card>
      {keys.length ? (
        <Card>
          <SectionTitle>Changed Values</SectionTitle>
          {keys.map((k) => (
            <View key={k} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>{k}</Text>
              <Text style={{ color: colors.red }}>− {show(row.before && row.before[k])}</Text>
              <Text style={{ color: colors.green }}>+ {show(row.after && row.after[k])}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
