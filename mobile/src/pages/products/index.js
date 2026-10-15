import ListScreen, { inr } from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import { buildItemFields, useItemLookups } from "./itemFields";
import { BRAND_FIELDS, CATEGORY_FIELDS } from "./catalogFields";
import { useNavigate } from "../../navigation/router";
import { stockRowId } from "../inventory";

// Ports of pages/products/* — Items, Categories, Brands and their forms.

export function Items() {
  const navigate = useNavigate();
  return (
    <ListScreen
      title="Items"
      endpoint="/api/items"
      addPath="/products/items/new"
      editPath={(r) => `/products/items/${encodeURIComponent(r.id)}/edit`}
      searchPlaceholder="Search items..."
      rowActions={(r) => [{ label: "View stock", icon: "layers", onPress: () => navigate(`/inventory/item/${encodeURIComponent(stockRowId(r.name, r.warehouse))}`) }]}
      card={(r) => ({
        title: r.name,
        subtitle: [r.itemCode || r.id, r.category, r.brand].filter(Boolean).join(" · "),
        amount: r.sellingPrice ? inr(r.sellingPrice) : undefined,
        meta: [
          { icon: "tag", text: r.itemType },
          { label: "HSN", text: r.hsnCode },
          { label: "Tax", text: `${r.taxPercent || 0}%` },
          { label: "Unit", text: r.unit },
          r.size ? { text: r.size } : null,
        ],
        status: r.status,
        icon: "package",
      })}
    />
  );
}

export function ItemForm() {
  const { categories, brands, warehouses, createCategory, createBrand, createWarehouse } = useItemLookups();
  const fields = buildItemFields({
    categories,
    brands,
    warehouses,
    onCreateCategory: createCategory,
    onCreateBrand: createBrand,
    onCreateWarehouse: createWarehouse,
  });
  return <RecordFormScreen entity="Item" endpoint="/api/items" fields={fields} />;
}

export function Categories() {
  return (
    <ListScreen
      title="Categories"
      endpoint="/api/categories"
      addPath="/products/categories/new"
      editPath={(r) => `/products/categories/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.name,
        subtitle: [r.id, r.materialType].filter(Boolean).join(" · "),
        meta: [
          { label: "Unit", text: r.unit },
          { label: "Tax", text: `${r.taxRate ?? 0}%` },
          { icon: "package", text: `${r.itemCount ?? 0} items` },
        ],
        status: r.status,
        icon: "package",
      })}
    />
  );
}

export function CategoryForm() {
  return <RecordFormScreen entity="Category" endpoint="/api/categories" fields={CATEGORY_FIELDS} />;
}

export function Brands() {
  return (
    <ListScreen
      title="Brands"
      endpoint="/api/brands"
      addPath="/products/brands/new"
      editPath={(r) => `/products/brands/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.name,
        subtitle: [r.id, r.manufacturer].filter(Boolean).join(" · "),
        meta: [
          { label: "Material", text: r.material },
          { icon: "package", text: `${r.itemCount ?? 0} items` },
        ],
        status: r.status,
        icon: "store",
      })}
    />
  );
}

export function BrandForm() {
  return <RecordFormScreen entity="Brand" endpoint="/api/brands" fields={BRAND_FIELDS} />;
}
