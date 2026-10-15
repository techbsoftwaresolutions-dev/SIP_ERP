import OutstandingPage from "../../components/data/OutstandingPage";

export default function SupplierOutstanding() {
  return (
    <OutstandingPage
      title="Outstanding Payables"
      crumbs={["Dashboard", "Suppliers", "Outstanding Payables"]}
      endpoint="/api/suppliers/outstanding"
      partyKey="supplier"
      partyLabel="Supplier"
    />
  );
}
