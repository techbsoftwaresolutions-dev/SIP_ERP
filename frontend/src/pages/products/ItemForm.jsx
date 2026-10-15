import RecordFormPage from "../../components/forms/RecordFormPage";
import { buildItemFields, useItemLookups } from "./itemFields";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether the
// route carries an `:id` (`/products/items/new` vs `/products/items/:id/edit`),
// so the two can never drift apart.
export default function ItemForm() {
  const { categories, brands, warehouses, createCategory, createBrand, createWarehouse } = useItemLookups();
  const { fields: customFields } = useCustomFields("item");

  const fields = buildItemFields({
    categories,
    brands,
    warehouses,
    onCreateCategory: createCategory,
    onCreateBrand: createBrand,
    onCreateWarehouse: createWarehouse,
  });

  return (
    <RecordFormPage
      entity="Item"
      endpoint="/api/items"
      listPath="/products/items"
      crumbs={["Dashboard", "Products", "Items"]}
      fields={[...fields, ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
