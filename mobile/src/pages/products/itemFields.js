import { useEffect, useState } from "react";
import api from "../../api/client";

export const STATUS_OPTIONS = ["Active", "Deactive"];

// What role an item plays in production. Descriptive only — the BOM and work
// order pickers deliberately don't filter on it (a sub-assembly is a finished
// good to one BOM and a component to the next).
export const ITEM_TYPES = ["Raw Material", "Semi-Finished", "Finished Good", "Consumable", "Spare Part"];

// Loads the live Category/Brand/Warehouse lists and exposes create-inline
// helpers — each POSTs a new record, adds it to local state so it shows up
// in the dropdown immediately, and returns its name for the combobox to
// select. Shared by the Items list page (edit modal) and the standalone Add
// Item page so both get the same behavior for free.
export function useItemLookups() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.swr("/api/categories?page=1&pageSize=200", (r) => setCategories(r.data || []));
    api.swr("/api/brands?page=1&pageSize=200", (r) => setBrands(r.data || []));
    api.swr("/api/warehouses?page=1&pageSize=200", (r) => setWarehouses(r.data || []));
  }, []);

  const createCategory = async (name) => {
    const created = await api.post("/api/categories", { name });
    setCategories((prev) => [...prev, created]);
    return created.name;
  };

  const createBrand = async (name) => {
    const created = await api.post("/api/brands", { name });
    setBrands((prev) => [...prev, created]);
    return created.name;
  };

  const createWarehouse = async (name) => {
    const created = await api.post("/api/warehouses", { name });
    setWarehouses((prev) => [...prev, created]);
    return created.name;
  };

  return { categories, brands, warehouses, createCategory, createBrand, createWarehouse };
}

// Shared field definitions for the Item form — used by both the Items list
// page (edit modal) and the standalone Add Item page, so the two never
// drift apart. `categories`/`brands`/`warehouses` are the live lists fetched
// from the API; `onCreateCategory`/`onCreateBrand`/`onCreateWarehouse`
// (optional) let those dropdowns create a brand-new option inline — see
// SearchableSelect.
export function buildItemFields({
  categories,
  brands,
  warehouses,
  onCreateCategory,
  onCreateBrand,
  onCreateWarehouse,
}) {
  return [
    { key: "name", label: "Product Name", required: true, placeholder: "Enter your product name" },
    { key: "itemCode", label: "Item Code", placeholder: "Enter your item code" },
    {
      key: "itemType",
      label: "Item Type",
      type: "select",
      options: ITEM_TYPES,
      defaultValue: "Raw Material",
    },
    { key: "description", label: "Description", type: "textarea", placeholder: "Enter item description", full: true },
    {
      key: "hsnCode",
      label: "HSN Code",
      type: "auto-or-manual",
      placeholder: "Enter your HSN code",
      generate: () => String(Math.floor(10000000 + Math.random() * 90000000)),
      // Only enforced while the "Manual" mode is active — see AddRecordForm,
      // which treats `required` on an auto-or-manual field as mode-scoped.
      required: true,
    },
    { key: "taxPercent", label: "Tax (%)", type: "number", placeholder: "Enter your tax percentage" },
    {
      key: "category",
      label: "Category",
      type: "combo",
      placeholder: "Select or search category",
      options: categories.map((c) => c.name),
      onCreate: onCreateCategory,
    },
    {
      key: "brand",
      label: "Brand",
      type: "combo",
      placeholder: "Select or search brand",
      options: brands.map((b) => b.name),
      onCreate: onCreateBrand,
    },
    { key: "size", label: "Size / Specification", placeholder: "Enter your size / specification" },
    { key: "unit", label: "Unit", type: "select", options: ["Pcs", "Box", "Kg", "Litre", "Set", "Nos", "Roll", "Sheet"] },
    {
      key: "warehouse",
      label: "Warehouse",
      type: "combo",
      placeholder: "Select or search warehouse",
      options: warehouses.map((w) => w.name),
      onCreate: onCreateWarehouse,
    },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "purchasePrice", label: "Purchase Price (₹)", type: "number", placeholder: "Enter your purchase price" },
    { key: "sellingPrice", label: "Selling Price (₹)", type: "number", placeholder: "Enter your selling price" },
  ];
}
