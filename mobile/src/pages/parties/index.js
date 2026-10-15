import { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import ListScreen, { inr } from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import { AddRecordForm, SearchableSelect } from "../../components/forms";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, Icon, IconButton, KeyValueGrid, Loader, SectionTitle, StatCard, StatGrid, StatusBadge, useFeedback } from "../../components/ui";
import { RecentRow } from "../dashboard/Dashboard";
import { usePermissions } from "../../context/SessionContext";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate, useParams } from "../../navigation/router";
import useRecord, { useList } from "../../hooks/useRecord";
import { CUSTOMER_FIELDS } from "../customers/customerFields";
import { SUPPLIER_FIELDS } from "../suppliers/supplierFields";
import { colors } from "../../theme";

// Customers and Suppliers are the same four screens with different nouns —
// ports of pages/customers/* and pages/suppliers/* on the web.
const KINDS = {
  customer: {
    noun: "Customer",
    plural: "Customers",
    base: "/customers",
    endpoint: "/api/customers",
    groups: "/api/customer-groups",
    fields: CUSTOMER_FIELDS,
    typeKey: "customerType",
    module: "customers",
  },
  supplier: {
    noun: "Supplier",
    plural: "Suppliers",
    base: "/suppliers",
    endpoint: "/api/suppliers",
    groups: "/api/supplier-groups",
    fields: SUPPLIER_FIELDS,
    typeKey: "supplierType",
    module: "suppliers",
  },
};

function PartyList({ kind }) {
  const k = KINDS[kind];
  const navigate = useNavigate();
  return (
    <ListScreen
      title={`${k.noun} List`}
      endpoint={k.endpoint}
      addPath={`${k.base}/new`}
      editPath={(r) => `${k.base}/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `${k.base}/${encodeURIComponent(r.id)}`}
      searchPlaceholder={`Search ${k.plural.toLowerCase()}...`}
      tabs={{
        field: "status",
        options: [
          { label: `All ${k.plural}`, value: undefined },
          { label: "Active", value: "Active" },
          { label: "Inactive", value: "Inactive" },
        ],
      }}
      card={(r) => ({
        title: r.name,
        subtitle: [r.id, r.city].filter(Boolean).join(" · "),
        amount: Number(r.outstanding) ? inr(r.outstanding) : undefined,
        meta: [
          { icon: "phone", text: r.phone },
          { icon: "mail", text: r.email },
          kind === "customer" ? { icon: "cart", text: `${r.totalOrders ?? 0} orders` } : { icon: "package", text: `${r.itemsSupplied ?? 0} items` },
        ],
        status: r.status,
      })}
      rowActions={(r) => [
        r.phone ? { label: `Call ${r.phone}`, icon: "phone", onPress: () => Linking.openURL(`tel:${r.phone}`) } : null,
        kind === "customer" ? { label: "View ledger", icon: "file", onPress: () => navigate(`/customers/ledger`, { state: { party: r.name } }) } : null,
      ]}
    />
  );
}

function PartyForm({ kind }) {
  const k = KINDS[kind];
  return <RecordFormScreen entity={k.noun} endpoint={k.endpoint} fields={k.fields} successMessage={undefined} />;
}

function PartyDetail({ kind }) {
  const k = KINDS[kind];
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { user } = useAuth();
  const { data: p, error, refreshing, reload } = useRecord(`${k.endpoint}/${encodeURIComponent(id)}`);

  if (error) {
    return (
      <Screen title={k.noun}>
        <ErrorBox message={error} />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen title={k.noun}>
        <Loader />
      </Screen>
    );
  }

  const orders = p.recentOrders || [];
  const invoices = p.recentInvoices || [];

  return (
    <Screen
      title={p.name}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can(k.module, "edit") ? [{ icon: "edit", label: "Edit", onPress: () => navigate(`${k.base}/${encodeURIComponent(p.id)}/edit`) }] : undefined}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, flex: 1 }}>{p.name}</Text>
          <StatusBadge status={p.status} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {p.phone ? <Button small variant="secondary" icon="phone" title="Call" onPress={() => Linking.openURL(`tel:${p.phone}`)} /> : null}
          {p.phone ? (
            <Button small variant="secondary" icon="whatsapp" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${String(p.phone).replace(/\D/g, "").slice(-10)}`)} />
          ) : null}
          {p.email ? <Button small variant="secondary" icon="mail" title="Email" onPress={() => Linking.openURL(`mailto:${p.email}`)} /> : null}
        </View>
        <KeyValueGrid
          rows={[
            [`${k.noun} Code`, p.id],
            [`${k.noun} Type`, p[k.typeKey]],
            ["Contact Person", p.contactPerson],
            ["Mobile No.", p.phone],
            ["Email", p.email],
            ["GST No.", p.gstNo],
            ["Payment Terms", p.paymentTerms],
            ["City", p.city],
            ["State", p.state],
            ["Pincode", p.pincode],
            ["Address", p.address, { full: true }],
          ]}
        />
      </Card>

      <StatGrid>
        {kind === "customer" ? (
          <>
            <StatCard label="Total Orders" value={p.totalOrders ?? 0} icon="cart" />
            <StatCard label="Total Invoices" value={p.totalInvoices ?? 0} icon="file" color="purple" />
            <StatCard label="Invoice Amount" value={inr(p.invoicedAmount)} icon="banknote" color="green" />
            <StatCard label="Outstanding" value={inr(p.outstanding)} icon="alertCircle" color="red" />
          </>
        ) : (
          <>
            <StatCard label="Items Supplied" value={p.itemsSupplied ?? 0} icon="package" />
            <StatCard label="Outstanding" value={inr(p.outstanding)} icon="alertCircle" color="red" />
          </>
        )}
      </StatGrid>

      <Card>
        <SectionTitle>{kind === "customer" ? "Recent Sales Orders" : "Recent Purchase Orders"}</SectionTitle>
        {orders.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>{kind === "customer" ? "No sales orders yet." : "No purchase orders yet."}</Text>
        ) : (
          orders.map((o) => (
            <RecentRow
              key={o.id}
              title={o.orderNo || o.id}
              sub={o.orderDate || "—"}
              amount={inr(o.amount)}
              status={o.status}
              onPress={() => navigate(kind === "customer" ? `/sales/orders/${encodeURIComponent(o.id)}` : `/purchase/orders/${encodeURIComponent(o.id)}`)}
            />
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>{kind === "customer" ? "Recent Invoices" : "Recent Purchase Invoices"}</SectionTitle>
        {invoices.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>{kind === "customer" ? "No invoices yet." : "No purchase invoices yet."}</Text>
        ) : (
          invoices.map((inv) => (
            <RecentRow
              key={inv.id}
              title={inv.id}
              sub={`${inv.date || "—"}${inv.balance != null ? ` · Balance ${inr(inv.balance)}` : ""}`}
              amount={inr(inv.amount)}
              status={inv.status}
              onPress={kind === "customer" ? () => navigate(`/sales/invoices/${encodeURIComponent(inv.id)}`) : undefined}
            />
          ))
        )}
      </Card>
      {kind === "customer" && user?.role === "Administrator" && Number(p.outstanding) > 0 ? (
        <Pressable onPress={() => navigate("/ai/reminder", { state: { customer: p.name, phone: p.phone, email: p.email } })}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="sparkles" color={colors.purple} />
            <Text style={{ flex: 1, fontWeight: "600" }}>Draft a payment reminder with AI</Text>
            <Icon name="chevronRight" color={colors.textLight} />
          </Card>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function PartyGroups({ kind }) {
  const k = KINDS[kind];
  return (
    <ListScreen
      title={`${k.noun} Groups`}
      endpoint={k.groups}
      card={(r) => ({ title: r.name, subtitle: [r.id, r.description].filter(Boolean).join(" · "), status: r.status, icon: "users" })}
      addConfig={{
        buttonLabel: "+ Add Group",
        modalTitle: `Add ${k.noun} Group`,
        successMessage: `${k.noun} group added.`,
        fields: [
          { key: "name", label: "Group Name", required: true, placeholder: "Enter your group name" },
          { key: "description", label: "Description", placeholder: "Enter your description" },
        ],
      }}
    />
  );
}

// Port of components/data/LedgerPage.jsx — party filter, balance tiles and
// the entries with add / edit / delete.
function PartyLedger({ kind }) {
  const k = KINDS[kind];
  const { state } = useLocation();
  const { toast, confirm } = useFeedback();
  const { can } = usePermissions();
  const parties = useList(`${k.endpoint}?page=1&pageSize=200`);
  const [selected, setSelected] = useState((state && state.party) || "all");
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {} = add, row = edit
  const ledgerEndpoint = `${k.endpoint}/ledger`;
  const param = kind === "customer" ? "customer" : "supplier";

  const load = useCallback(() => {
    const q = selected !== "all" ? `?${param}=${encodeURIComponent(selected)}` : "";
    return api
      .get(`${ledgerEndpoint}${q}`)
      .then((r) => {
        setLedger(r);
        setError("");
      })
      .catch((err) => setError(err.message || "Could not load the ledger."));
  }, [selected, ledgerEndpoint, param]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = [
    { key: "partyName", label: k.noun, type: "select", required: true, options: parties.map((p) => p.name) },
    { key: "type", label: "Type", placeholder: "e.g. Payment, Opening Balance" },
    { key: "referenceNo", label: "Reference No.", placeholder: "Enter your reference number" },
    { key: "debit", label: "Debit (₹)", type: "number", placeholder: "Enter your debit amount" },
    { key: "credit", label: "Credit (₹)", type: "number", placeholder: "Enter your credit amount" },
  ];

  const save = async (values) => {
    if (editing && editing.id) await api.put(`${ledgerEndpoint}/${encodeURIComponent(editing.id)}`, values);
    else await api.post(ledgerEndpoint, values);
    setEditing(null);
    toast(editing && editing.id ? "Ledger entry updated." : "Ledger entry added.");
    load();
  };

  const remove = async (row) => {
    if (!(await confirm({ title: "Delete ledger entry", message: "Delete this ledger entry? This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.delete(`${ledgerEndpoint}/${encodeURIComponent(row.id)}`);
      load();
    } catch (err) {
      toast(err.message || "Failed to delete.");
    }
  };

  const entries = (ledger && ledger.entries) || [];
  const canWrite = can(k.module, "edit");

  return (
    <Screen
      title={`${k.noun} Ledger`}
      onRefresh={load}
      headerRight={can(k.module, "create") ? [{ icon: "plus", label: "Add entry", onPress: () => setEditing(selected !== "all" ? { partyName: selected, __new: true } : { __new: true }) }] : undefined}
    >
      <SearchableSelect
        value={selected}
        onChange={setSelected}
        options={[{ label: `All ${k.plural}`, value: "all" }, ...parties.map((p) => ({ label: p.name, value: p.name }))]}
        title={`Select ${k.noun}`}
      />
      <ErrorBox message={error} />
      {!ledger ? (
        <Loader />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Opening Balance" value={inr(ledger.openingBalance)} />
            <StatCard label="Total Debit" value={inr(ledger.totalDebit)} color="red" />
            <StatCard label="Total Credit" value={inr(ledger.totalCredit)} color="green" />
            <StatCard label="Closing Balance" value={inr(ledger.closingBalance)} color="purple" />
          </StatGrid>
          {entries.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", padding: 20 }}>No ledger entries yet.</Text>
          ) : (
            entries.map((e) => (
              <Card key={e.id} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{e.type || "Entry"}{e.partyName && selected === "all" ? ` · ${e.partyName}` : ""}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{[e.date, e.referenceNo].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {e.debit ? <Text style={{ color: colors.red, fontWeight: "700" }}>Dr {inr(e.debit)}</Text> : null}
                    {e.credit ? <Text style={{ color: colors.green, fontWeight: "700" }}>Cr {inr(e.credit)}</Text> : null}
                  </View>
                  {canWrite ? <IconButton name="edit" onPress={() => setEditing(e)} /> : null}
                  {can(k.module, "delete") ? <IconButton name="trash" color={colors.red} onPress={() => remove(e)} /> : null}
                </View>
              </Card>
            ))
          )}
        </>
      )}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{editing && editing.id ? "Edit Ledger Entry" : "Add Ledger Entry"}</Text>
            <IconButton name="close" color={colors.text} onPress={() => setEditing(null)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {editing ? (
              <AddRecordForm fields={fields} initialValues={editing} onSubmit={save} onCancel={() => setEditing(null)} submitLabel={editing.id ? "Save Changes" : "Add Entry"} />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

// Port of components/data/OutstandingPage.jsx.
function PartyOutstanding({ kind }) {
  const k = KINDS[kind];
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      api
        .get(`${k.endpoint}/outstanding`)
        .then((r) => setRows(r || []))
        .catch((err) => setError(err.message || "Could not load.")),
    [k.endpoint]
  );
  useEffect(() => {
    load();
  }, [load]);
  const key = kind;
  const total = (rows || []).reduce((a, r) => a + (r.totalOutstanding || 0), 0);
  return (
    <Screen title={kind === "customer" ? "Outstanding Receivables" : "Outstanding Payables"} onRefresh={load}>
      <ErrorBox message={error} />
      {rows === null ? (
        <Loader />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total Outstanding" value={inr(total)} color="red" icon="alertCircle" />
            <StatCard label={`${k.plural} With Balance`} value={rows.length} icon="users" />
          </StatGrid>
          {rows.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", padding: 20 }}>No outstanding balances.</Text>
          ) : (
            rows
              .slice()
              .sort((a, b) => (b.totalOutstanding || 0) - (a.totalOutstanding || 0))
              .map((r) => (
                <RecentRow
                  key={r[key]}
                  title={r[key]}
                  sub={`${r.invoiceCount} open invoice${r.invoiceCount === 1 ? "" : "s"}`}
                  amount={inr(r.totalOutstanding)}
                  onPress={() => navigate(`${k.base}/ledger`, { state: { party: r[key] } })}
                />
              ))
          )}
        </>
      )}
    </Screen>
  );
}

export const CustomerLedger = () => <PartyLedger kind="customer" />;
export const SupplierLedger = () => <PartyLedger kind="supplier" />;
export const CustomerOutstanding = () => <PartyOutstanding kind="customer" />;
export const SupplierOutstanding = () => <PartyOutstanding kind="supplier" />;

export const CustomerList = () => <PartyList kind="customer" />;
export const CustomerForm = () => <PartyForm kind="customer" />;
export const CustomerDetail = () => <PartyDetail kind="customer" />;
export const CustomerGroups = () => <PartyGroups kind="customer" />;
export const SupplierList = () => <PartyList kind="supplier" />;
export const SupplierForm = () => <PartyForm kind="supplier" />;
export const SupplierDetail = () => <PartyDetail kind="supplier" />;
export const SupplierGroups = () => <PartyGroups kind="supplier" />;
