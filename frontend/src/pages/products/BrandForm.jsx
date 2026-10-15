import RecordFormPage from "../../components/forms/RecordFormPage";
import { BRAND_FIELDS } from "./catalogFields";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function BrandForm() {
  const { fields: customFields } = useCustomFields("brand");
  return (
    <RecordFormPage
      entity="Brand"
      endpoint="/api/brands"
      listPath="/products/brands"
      crumbs={["Dashboard", "Products", "Brands"]}
      fields={[...BRAND_FIELDS, ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
