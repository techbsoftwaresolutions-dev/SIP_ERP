import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import ListScreen from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, KeyValueGrid, Loader, StatCard, StatGrid, StatusBadge } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { STOCK_MOVE_ROLES } from "../../navigation/menu";
import { useLocation, useNavigate, useParams } from "../../navigation/router";
import { buildStockInFields, useStockInLookups } from "./stockInFields";
import { buildStockOutFields, useStockOutLookups } from "./stockOutFields";
import { colors } from "../../theme";

// Ports of pages/inventory/* — Stock Overview, Stock Detail, Stock In/Out
// (+ forms), Stock Transfer and Stock Adjustment.

const qty = (n) => (Number(n) || 0).toLocaleString("en-IN");
const STATUS_TO_BADGE = { Normal: "In Stock", "Low Stock": "Low Stock", "Out of Stock": "Out of Stock" };

// Same id the /api/inventory rows carry (backend server.js).
export const stockRowId = (name, warehouse) => `${name}__${warehouse ?? null}`.replace(/\s+/g, "-");

export function StockOverview() {
  const navigate = useNavigate();
  return (
    <ListScreen
      title="Stock Overview"
      endpoint="/api/inventory"
      pageSize={50}
      clientSearch
      tabs={{ field: "stockStatus", options: [{ label: "All", value: undefined }, { label: "Normal", value: "Normal" }, { label: "Low Stock", value: "Low Stock" }, { label: "Out of Stock", value: "Out of Stock" }] }}
      onPressRow={(r) => navigate(`/inventory/item/${encodeURIComponent(r.id)}`, { state: { row: r } })}
      canAdd={false}
      card={(r) => ({
        title: r.productName,
        subtitle: [r.productCode, r.warehouse].filter((v) => v && v !== "—").join(" · "),
        amount: `${qty(r.available)} ${r.unit || ""}`,
        meta: [
          { label: "Reserved", text: qty(r.reserved) },
          { label: "Damaged", text: qty(r.damaged) },
          { text: [r.category, r.brand].filter((v) => v && v !== "—").join(" · ") },
        ],
        status: STATUS_TO_BADGE[r.stockStatus] || r.stockStatus,
        icon: "package",
      })}
    />
  );
}

export function StockDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState(state && state.row ? state.row : null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) return;
    api
      .get("/api/inventory?page=1&pageSize=5000")
      .then((r) => {
        const match = (r.data || []).find((x) => String(x.id) === id);
        if (match) setRow(match);
        else setError("Could not find that stock item.");
      })
      .catch(() => setError("Could not load stock details."));
  }, [id, row]);

  if (error) return <Screen title="Stock"><ErrorBox message={error} /></Screen>;
  if (!row) return <Screen title="Stock"><Loader /></Screen>;
  const available = Number(row.available) || 0;
  const reserved = Number(row.reserved) || 0;
  const damaged = Number(row.damaged) || 0;
  const canMove = STOCK_MOVE_ROLES.includes(user?.role);

  return (
    <Screen title={row.productName}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: colors.text }}>{row.productName}</Text>
          <StatusBadge status={STATUS_TO_BADGE[row.stockStatus] || row.stockStatus} />
        </View>
        <KeyValueGrid
          rows={[
            ["Product Code", row.productCode],
            ["Warehouse", row.warehouse],
            ["Category", row.category],
            ["Brand", row.brand],
            ["Unit", row.unit],
          ]}
        />
      </Card>
      <StatGrid>
        <StatCard label="Available" value={qty(available)} icon="package" color="green" />
        <StatCard label="Reserved" value={qty(reserved)} icon="lock" color="amber" />
        <StatCard label="Damaged" value={qty(damaged)} icon="alertTriangle" color="red" />
        <StatCard label="Net Available" value={qty(available - reserved)} icon="checkCircle" color="teal" />
        <StatCard label="Total On Hand" value={qty(available + damaged)} icon="layers" color="purple" />
      </StatGrid>
      {canMove ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Stock In" icon="download" style={{ flex: 1 }} onPress={() => navigate("/inventory/stock-in/new", { state: { seed: { product: row.productName, warehouse: row.warehouse } } })} />
          <Button title="Stock Out" icon="upload" variant="secondary" style={{ flex: 1 }} onPress={() => navigate("/inventory/stock-out/new", { state: { seed: { product: row.productName, warehouse: row.warehouse, unit: row.unit } } })} />
        </View>
      ) : null}
    </Screen>
  );
}

export function StockIn() {
  return (
    <ListScreen
      title="Stock In"
      endpoint="/api/inventory/stock-in"
      addPath="/inventory/stock-in/new"
      editPath={(r) => `/inventory/stock-in/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.date, r.supplier].filter(Boolean).join(" · "),
        amount: `+${qty(r.acceptedQty || r.quantity)}`,
        meta: [
          { label: "Received", text: qty(r.quantity) },
          { label: "Accepted", text: qty(r.acceptedQty) },
          { label: "GRN", text: r.grnNumber },
          { label: "PO", text: r.poNumber },
          { label: "Batch", text: r.batchNo },
          { icon: "store", text: r.warehouse },
        ],
        status: r.status || "Pending QC",
        icon: "download",
      })}
    />
  );
}

export function StockInForm() {
  const { state } = useLocation();
  const { products, suppliers, warehouses, createWarehouse } = useStockInLookups();
  return (
    <RecordFormScreen
      entity="Stock In"
      endpoint="/api/inventory/stock-in"
      fields={buildStockInFields({ products, suppliers, warehouses, onCreateWarehouse: createWarehouse })}
      initialValues={state && state.seed ? state.seed : undefined}
      successMessage={undefined}
    />
  );
}

export function StockOut() {
  return (
    <ListScreen
      title="Stock Out"
      endpoint="/api/inventory/stock-out"
      addPath="/inventory/stock-out/new"
      editPath={(r) => `/inventory/stock-out/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.date, r.issueType].filter(Boolean).join(" · "),
        amount: `−${qty(r.quantity)} ${r.unit || "Nos"}`,
        meta: [
          { label: "Ref", text: r.referenceNo },
          { text: r.departmentOrCustomer },
          { label: "Batch", text: r.batchNo },
          { icon: "store", text: r.warehouse },
        ],
        status: r.status || "Pending",
        icon: "upload",
      })}
    />
  );
}

export function StockOutForm() {
  const { state } = useLocation();
  const { products, warehouses, createWarehouse } = useStockOutLookups();
  return (
    <RecordFormScreen
      entity="Stock Out"
      endpoint="/api/inventory/stock-out"
      fields={buildStockOutFields({ products, warehouses, onCreateWarehouse: createWarehouse })}
      initialValues={state && state.seed ? state.seed : undefined}
    />
  );
}

export function StockTransfer() {
  return (
    <ListScreen
      title="Stock Transfer"
      endpoint="/api/inventory/stock-transfer"
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: qty(r.quantity),
        meta: [{ icon: "store", text: `${r.warehouse || "—"} → ${r.toWarehouse || "—"}` }],
        icon: "repeat",
      })}
      addConfig={{
        buttonLabel: "+ New Transfer",
        modalTitle: "New Stock Transfer",
        successMessage: "Stock transfer recorded.",
        fields: [
          { key: "product", label: "Product", required: true, placeholder: "Enter your product" },
          { key: "quantity", label: "Quantity", type: "number", placeholder: "Enter your quantity" },
          { key: "warehouse", label: "From Warehouse", placeholder: "Enter your from warehouse" },
          { key: "toWarehouse", label: "To Warehouse", placeholder: "Enter your to warehouse" },
        ],
      }}
    />
  );
}

export function StockAdjustment() {
  return (
    <ListScreen
      title="Stock Adjustment"
      endpoint="/api/inventory/stock-adjustment"
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: `${Number(r.quantity) > 0 ? "+" : ""}${qty(r.quantity)}`,
        meta: [
          { icon: "store", text: r.warehouse },
          { label: "Reason", text: r.reason },
        ],
        icon: "tool",
      })}
      addConfig={{
        buttonLabel: "+ New Adjustment",
        modalTitle: "New Stock Adjustment",
        successMessage: "Stock adjustment recorded.",
        fields: [
          { key: "product", label: "Product", required: true, placeholder: "Enter your product" },
          { key: "quantity", label: "Quantity (+/-)", type: "number", signed: true, placeholder: "Enter your quantity" },
          { key: "warehouse", label: "Warehouse", placeholder: "Enter your warehouse" },
          { key: "reason", label: "Reason", placeholder: "Enter your reason" },
        ],
      }}
    />
  );
}
