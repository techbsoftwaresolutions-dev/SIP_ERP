import { useEffect, useState } from "react";
import api from "../../api/client";

export const ISSUE_TYPES = ["Production Issue", "Packing Consumption", "Customer Dispatch", "Stock Transfer", "Supplier Return", "Other"];
export const STATUS_OPTIONS = ["Pending", "Completed", "Dispatched", "Returned"];
export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];

// Loads the live Product/Warehouse lists the Stock Out form's dropdowns
// draw from. Warehouse also gets a create-inline helper — POSTs a new
// warehouse, adds it to local state so it shows up immediately, and returns
// its name for the combobox to select (same pattern as the Add Item form).
export function useStockOutLookups() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.swr("/api/items?page=1&pageSize=200", (r) => setProducts(r.data || []));
    api.swr("/api/warehouses?page=1&pageSize=200", (r) => setWarehouses(r.data || []));
  }, []);

  const createWarehouse = async (name) => {
    const created = await api.post("/api/warehouses", { name });
    setWarehouses((prev) => [...prev, created]);
    return created.name;
  };

  return { products, warehouses, createWarehouse };
}

// Shared field definitions for the Stock Out form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
export function buildStockOutFields({ products, warehouses, onCreateWarehouse }) {
  return [
    { key: "product", label: "Product", type: "combo", required: true, options: products.map((p) => p.name) },
    { key: "issueType", label: "Issue Type", type: "select", options: ISSUE_TYPES },
    { key: "referenceNo", label: "Reference No.", placeholder: "Enter your reference number" },
    { key: "departmentOrCustomer", label: "Department / Customer", placeholder: "Enter your department or customer" },
    { key: "batchNo", label: "Batch No.", placeholder: "Enter your batch number" },
    { key: "quantity", label: "Qty Out", type: "number", placeholder: "Enter your quantity out" },
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
