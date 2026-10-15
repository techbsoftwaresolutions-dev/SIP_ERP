import RecordFormPage from "../../components/forms/RecordFormPage";
import { WORK_CENTER_FIELDS } from "./manufacturingFields";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function WorkCenterForm() {
  const { fields: customFields } = useCustomFields("work-center");
  return (
    <RecordFormPage
      entity="Work Center"
      endpoint="/api/manufacturing/work-centers"
      listPath="/manufacturing/work-centers"
      crumbs={["Dashboard", "Manufacturing", "Work Centers"]}
      fields={[...WORK_CENTER_FIELDS, ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
