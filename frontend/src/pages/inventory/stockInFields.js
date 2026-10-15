import { useEffect, useState } from "react";
import api from "../../api/client";

export const STATUS_OPTIONS = ["Pending QC", "Completed", "Rejected"];
export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet", "Mtr", "Pair"];

// Loads the live Product/Supplier/Warehouse lists the Stock In form's
// dropdowns draw from. Warehouse also gets a create-inline helper — POSTs a
// new warehouse, adds it to local state so it shows up immediately, and
// returns its name for the combobox to select (same pattern as
// Category/Brand/Warehouse on the Add Item form).
export function useStockInLookups() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.swr("/api/items?page=1&pageSize=200", (r) => setProducts(r.data || []));
    api.swr("/api/suppliers?page=1&pageSize=200", (r) => setSuppliers(r.data || []));
    api.swr("/api/warehouses?page=1&pageSize=200", (r) => setWarehouses(r.data || []));
  }, []);

  const createWarehouse = async (name) => {
    const created = await api.post("/api/warehouses", { name });
    setWarehouses((prev) => [...prev, created]);
    return created.name;
  };

  return { products, suppliers, warehouses, createWarehouse };
}

// Shared field definitions for the Stock In form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
export function buildStockInFields({ products, suppliers, warehouses, onCreateWarehouse }) {
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
          hint(`In Stock: ${(match.qty || 0).toLocaleString("en-IN")} ${match.unit || "Nos"} in ${match.warehouse || "Main Warehouse"}`);
        } else {
          hint("");
        }
      },
    },
    { key: "supplier", label: "Supplier", type: "combo", options: suppliers.map((s) => s.name) },
    { key: "poNumber", label: "Purchase Order No", placeholder: "Enter your purchase order no" },
    { key: "grnNumber", label: "GRN No.", placeholder: "Enter your GRN number" },
    { key: "batchNo", label: "Batch No.", placeholder: "Enter your batch number" },
    { key: "quantity", label: "Received Qty", type: "number", required: true, placeholder: "Enter your received quantity" },
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
