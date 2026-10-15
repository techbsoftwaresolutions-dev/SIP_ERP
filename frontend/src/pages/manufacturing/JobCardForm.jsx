import RecordFormPage from "../../components/forms/RecordFormPage";
import { buildJobCardFields } from "./manufacturingFields";
import { useManufacturingLookups } from "./manufacturingLookups";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function JobCardForm() {
  const { workOrders, workCenters, machines } = useManufacturingLookups({
    workOrders: true,
    workCenters: true,
    machines: true,
  });
  const { fields: customFields } = useCustomFields("job-card");

  return (
    <RecordFormPage
      entity="Job Card"
      endpoint="/api/manufacturing/job-cards"
      listPath="/manufacturing/job-cards"
      crumbs={["Dashboard", "Manufacturing", "Job Cards"]}
      fields={[...buildJobCardFields({ workOrders, workCenters, machines }), ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
