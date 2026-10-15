import { useEffect, useState, useCallback } from "react";
import api from "../../api/client";
import Icon from "../ui/Icon";
import PageHeader from "../layout/PageHeader";
import DataTable from "./DataTable";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import AddRecordForm from "../forms/AddRecordForm";
import Select from "../forms/Select";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function LedgerPage({ title, crumbs, partyLabel, partiesEndpoint, ledgerEndpoint, queryParamName }) {
  const [parties, setParties] = useState([]);
  const [selected, setSelected] = useState("all");
  const [ledger, setLedger] = useState({ entries: [], openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    api.get(partiesEndpoint).then((r) => setParties(r.data || []));
  }, [partiesEndpoint]);

  const load = useCallback(() => {
    setLoading(true);
    const query = selected !== "all" ? `?${queryParamName}=${encodeURIComponent(selected)}` : "";
    api
      .get(`${ledgerEndpoint}${query}`)
      .then(setLedger)
      .finally(() => setLoading(false));
  }, [selected, ledgerEndpoint, queryParamName]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "referenceNo", header: "Reference No." },
    { key: "debit", header: "Debit (₹)", render: (r) => (r.debit ? inr(r.debit) : "—") },
    { key: "credit", header: "Credit (₹)", render: (r) => (r.credit ? inr(r.credit) : "—") },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="icon-btn" title="Edit" onClick={() => setEditingEntry(r)}><Icon name="edit" /></button>
          <button
            type="button"
            className="icon-btn danger"
            title="Delete"
            onClick={() => setDeleteTarget(r)}
            disabled={deletingId === r.id}
          >
            <Icon name="trash" />
          </button>
        </div>
      ),
    },
  ];

  const addConfig = {
    modalTitle: `Add Ledger Entry`,
    fields: [
      {
        key: "partyName",
        label: partyLabel,
        type: "select",
        required: true,
        options: parties.map((p) => p.name),
      },
      { key: "type", label: "Type", placeholder: "Enter your type" },
      { key: "referenceNo", label: "Reference No.", placeholder: "Enter your reference number" },
      { key: "debit", label: "Debit (₹)", type: "number", placeholder: "Enter your debit amount" },
      { key: "credit", label: "Credit (₹)", type: "number", placeholder: "Enter your credit amount" },
    ],
  };

  const handleAdd = async (values) => {
    await api.post(ledgerEndpoint, values);
    setModalOpen(false);
    load();
  };

  const handleEditSubmit = async (values) => {
    await api.put(`${ledgerEndpoint}/${encodeURIComponent(editingEntry.id)}`, values);
    setEditingEntry(null);
    load();
  };

  const handleDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    setDeletingId(row.id);
    try {
      await api.delete(`${ledgerEndpoint}/${encodeURIComponent(row.id)}`);
      load();
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        crumbs={crumbs}
        actions={
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            + Add Ledger Entry
          </button>
        }
      />

      <div className="filter-bar">
        <div className="filter-field">
          <label>Select {partyLabel}</label>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="all">All {partyLabel}s</option>
            {parties.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Opening Balance</div>
          <div className="value">{inr(ledger.openingBalance)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Total Debit</div>
          <div className="value">{inr(ledger.totalDebit)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Total Credit</div>
          <div className="value">{inr(ledger.totalCredit)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Closing Balance</div>
          <div className="value">{inr(ledger.closingBalance)}</div>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} rows={ledger.entries} loading={loading} emptyText="No ledger entries yet." />
      </div>

      {modalOpen && (
        <Modal title={addConfig.modalTitle} onClose={() => setModalOpen(false)}>
          <AddRecordForm fields={addConfig.fields} onSubmit={handleAdd} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {editingEntry && (
        <Modal title="Edit Ledger Entry" onClose={() => setEditingEntry(null)}>
          <AddRecordForm
            fields={addConfig.fields}
            initialValues={editingEntry}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingEntry(null)}
            submitLabel="Save Changes"
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete ledger entry"
          message="Delete this ledger entry? This cannot be undone."
          confirming={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
