import { useEffect, useState } from "react";
import api from "../../api/client";

export const STATUS_OPTIONS = ["Completed", "Pending", "Dispatched", "Rejected"];
export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet", "Mtr", "Pair"];

// Loads the live Product/Supplier/Customer/Warehouse lists the Stock Out form's dropdowns
// draw from. Warehouse also gets a create-inline helper.
export function useStockOutLookups() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.swr("/api/items?page=1&pageSize=200", (r) => setProducts(r.data || []));
    api.swr("/api/suppliers?page=1&pageSize=200", (r) => setSuppliers(r.data || []));
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
    api.swr("/api/warehouses?page=1&pageSize=200", (r) => setWarehouses(r.data || []));
  }, []);

  const createWarehouse = async (name) => {
    const created = await api.post("/api/warehouses", { name });
    setWarehouses((prev) => [...prev, created]);
    return created.name;
  };

  return { products, suppliers, customers, warehouses, createWarehouse };
}

// Shared field definitions for the Stock Out form — copied from Stock In particulars
// so both In and Out have matching entry fields, layout, and data points.
export function buildStockOutFields({ products, suppliers = [], customers = [], warehouses, onCreateWarehouse }) {
  const partyOptions = Array.from(
    new Set([...customers.map((c) => c.name), ...suppliers.map((s) => s.name)])
  ).filter(Boolean);

  return [
    {
      key: "product",
      label: "Product",
      type: "combo",
      required: true,
      options: products.map((p) => p.name),
      onValueChange: (val, { fill, hint }) => {
        const match = products.find((p) => p.name === val);
        if (match) {
          fill({
            unit: match.unit || "Nos",
            warehouse: match.warehouse || "Main Warehouse",
            batchNo: match.batchNo || "",
          });
          hint(`Available Stock: ${(match.qty || 0).toLocaleString("en-IN")} ${match.unit || "Nos"} in ${match.warehouse || "Main Warehouse"}`);
        } else {
          hint("");
        }
      },
    },
    {
      key: "supplier",
      label: "Customer / Supplier",
      type: "combo",
      placeholder: "Select or enter customer / supplier",
      options: partyOptions.length > 0 ? partyOptions : suppliers.map((s) => s.name),
    },
    { key: "poNumber", label: "Purchase Order No", placeholder: "Enter your purchase order no" },
    { key: "grnNumber", label: "GRN No.", placeholder: "Enter your GRN number" },
    { key: "batchNo", label: "Batch No.", placeholder: "Enter your batch number" },
    { key: "quantity", label: "Qty Out", type: "number", required: true, placeholder: "Enter your quantity out" },
    { key: "acceptedQty", label: "Accepted Qty", type: "number", placeholder: "Enter your accepted quantity" },
    { key: "unit", label: "Unit", type: "select", options: UNITS },
    {
      key: "warehouse",
      label: "Warehouse",
      type: "combo",
      placeholder: "Select or search warehouse",
      options: warehouses.map((w) => w.name),
      onCreate: onCreateWarehouse,
    },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "reason", label: "Remarks", placeholder: "Enter your remarks" },
  ];
}
