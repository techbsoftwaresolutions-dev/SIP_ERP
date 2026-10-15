import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import { inr, num } from "./manufacturingLookups";

export default function Boms() {
  const columns = [
    { key: "id", header: "BOM No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "product", header: "Finished Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "version", header: "Version", render: (r) => r.version || "—" },
    { key: "outputQty", header: "Batch Size", render: (r) => `${num(r.outputQty)} ${r.unit || ""}`.trim() },
    { key: "components", header: "Components", render: (r) => (r.components || []).length },
    { key: "operations", header: "Operations", render: (r) => (r.operations || []).length },
    { key: "materialCost", header: "Material Cost", render: (r) => inr(r.materialCost) },
    { key: "totalCost", header: "Total Cost", render: (r) => <span className="cell-primary">{inr(r.totalCost)}</span> },
    {
      key: "costPerUnit",
      header: "Cost / Unit",
      render: (r) => inr((Number(r.totalCost) || 0) / (Number(r.outputQty) || 1)),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <SimpleListPage
      title="Bill of Materials"
      crumbs={["Dashboard", "Manufacturing", "Bill of Materials"]}
      endpoint="/api/manufacturing/boms"
      columns={columns}
      // `addConfig` is what switches on the row Edit/Delete buttons; the
      // fields are unused because both add and edit go to the standalone form.
      addConfig={{ buttonLabel: "+ New BOM", fields: [] }}
      addHref="/manufacturing/boms/new"
      editHref={(row) => `/manufacturing/boms/${row.id}/edit`}
    />
  );
}
