import RecordFormPage from "../../components/forms/RecordFormPage";
import { CATEGORY_FIELDS } from "./catalogFields";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function CategoryForm() {
  const { fields: customFields } = useCustomFields("category");
  return (
    <RecordFormPage
      entity="Category"
      endpoint="/api/categories"
      listPath="/products/categories"
      crumbs={["Dashboard", "Products", "Categories"]}
      fields={[...CATEGORY_FIELDS, ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
