import OutstandingPage from "../../components/data/OutstandingPage";

export default function CustomerOutstanding() {
  return (
    <OutstandingPage
      title="Outstanding Receivables"
      crumbs={["Dashboard", "Customers", "Outstanding Receivables"]}
      endpoint="/api/customers/outstanding"
      partyKey="customer"
      partyLabel="Customer"
    />
  );
}
