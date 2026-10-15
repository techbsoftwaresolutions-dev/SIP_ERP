import LedgerPage from "../../components/data/LedgerPage";

export default function SupplierLedger() {
  return (
    <LedgerPage
      title="Supplier Ledger"
      crumbs={["Dashboard", "Suppliers", "Supplier Ledger"]}
      partyLabel="Supplier"
      partiesEndpoint="/api/suppliers?page=1&pageSize=200"
      ledgerEndpoint="/api/suppliers/ledger"
      queryParamName="supplier"
    />
  );
}
