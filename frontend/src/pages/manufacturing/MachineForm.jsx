import RecordFormPage from "../../components/forms/RecordFormPage";
import { buildMachineFields } from "./manufacturingFields";
import { useManufacturingLookups } from "./manufacturingLookups";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function MachineForm() {
  const { workCenters } = useManufacturingLookups({ workCenters: true });
  const { fields: customFields } = useCustomFields("machine");

  return (
    <RecordFormPage
      entity="Machine"
      endpoint="/api/manufacturing/machines"
      listPath="/manufacturing/machines"
      crumbs={["Dashboard", "Manufacturing", "Machines"]}
      fields={[...buildMachineFields({ workCenters }), ...customFields]}
      transform={packCustomFields}
      loadTransform={unpackCustomFields}
    />
  );
}
