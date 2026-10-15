import LedgerPage from "../../components/data/LedgerPage";

export default function CustomerLedger() {
  return (
    <LedgerPage
      title="Customer Ledger"
      crumbs={["Dashboard", "Customers", "Customer Ledger"]}
      partyLabel="Customer"
      partiesEndpoint="/api/customers?page=1&pageSize=200"
      ledgerEndpoint="/api/customers/ledger"
      queryParamName="customer"
    />
  );
}
