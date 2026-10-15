import { isValidElement, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../layout/PageHeader";
import DataTable from "./DataTable";
import Pagination from "./Pagination";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import AddRecordForm from "../forms/AddRecordForm";
import ExportButtons from "./ExportButtons";
import usePaginatedData from "../../hooks/usePaginatedData";
import api from "../../api/client";
import Icon from "../ui/Icon";
import { usePermissions } from "../../context/PermissionsContext";
import useTableStyle from "../../hooks/useTableStyle";
import Loader from "../ui/Loader";
import Toast from "../ui/Toast";

// Generic table-row -> card fallback, used by any list page that doesn't
// supply its own `mobileCard` renderer. Shows every real column value, so
// nothing shown is invented/static — it's whatever the row actually has.
function GenericMobileCard({ row, columns, onEdit, onDelete }) {
  const fields = columns.filter((c) => c.key !== "__actions");
  return (
    <div className="m-generic-card">
      {fields.map((c) => (
        <div className="m-generic-row" key={c.key}>
          <span className="m-generic-label">{c.header}</span>
          <span className="m-generic-value">{c.render ? c.render(row) : row[c.key] ?? "—"}</span>
        </div>
      ))}
      {(onEdit || onDelete) && (
        <div className="m-generic-actions">
          {onEdit && <button type="button" className="icon-btn" title="Edit" onClick={onEdit}><Icon name="edit" /></button>}
          {onDelete && <button type="button" className="icon-btn danger" title="Delete" onClick={onDelete}><Icon name="trash" /></button>}
        </div>
      )}
    </div>
  );
}

export default function SimpleListPage({
  title,
  crumbs,
  endpoint,
  columns,
  addConfig,
  addHref,
  editHref,
  // Where a click on the record number goes when the page has a read-only
  // detail screen of its own; otherwise it opens the record for editing.
  detailHref,
  extraActions,
  rowActions,
  pageSize = 8,
  params,
  mobileCard,
  mobileTabs,
  mobileSummary,
  mobileSearchPlaceholder,
  // Short explanation shown between the page header and the table — for a
  // register whose records are created somewhere else, so the missing
  // "+ Add" button doesn't read as something being broken.
  note,
}) {
  const { data, page, setPage, total, totalPages, loading, reload } = usePaginatedData(endpoint, { pageSize, params });
  // The module is derived from `endpoint` (e.g. /api/customers -> customers)
  // so none of the ~20 pages using this component need a new prop.
  const { canEndpoint } = usePermissions();
  const tableStyle = useTableStyle();
  const canCreate = canEndpoint(endpoint, "create");
  const canEdit = canEndpoint(endpoint, "edit");
  const canDelete = canEndpoint(endpoint, "delete");
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileTab, setMobileTab] = useState(mobileTabs ? mobileTabs.options[0].value : undefined);
  // Desktop toolbar search. Filters the rows already loaded for this page —
  // the list endpoints have no server-side text search — so the placeholder
  // says "on this page" rather than implying it searches all of them.
  const [tableSearch, setTableSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);

  // A standalone "Add" page (see `addHref`) navigates back here with a
  // toast message in router state — surface it once, then clear the state
  // so refreshing or navigating back doesn't show it again.
  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 3500);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const resourceBase = (addConfig && addConfig.endpoint) || endpoint;

  const refreshAfterChange = () => {
    if (page === 1) {
      reload();
    } else {
      setPage(1);
    }
  };

  const handleAdd = async (values) => {
    const payload = addConfig.transform ? addConfig.transform(values) : values;
    await api.post(resourceBase, payload);
    setModalOpen(false);
    setToast(addConfig.successMessage || "Added successfully.");
    setTimeout(() => setToast(""), 2500);
    refreshAfterChange();
    if (addConfig.onSuccess) addConfig.onSuccess();
  };

  const handleEditSubmit = async (values) => {
    const payload = addConfig.transform ? addConfig.transform(values) : values;
    await api.put(`${resourceBase}/${encodeURIComponent(editingRow.id)}`, payload);
    setEditingRow(null);
    setToast("Updated successfully.");
    setTimeout(() => setToast(""), 2500);
    reload();
    if (addConfig.onSuccess) addConfig.onSuccess();
  };

  // Clearing the tick boxes whenever the underlying rows change stops a
  // selection made on page 1 from silently applying to page 2's records.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, endpoint]);

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let failed = 0;
    for (const id of ids) {
      try {
        await api.delete(`${resourceBase}/${encodeURIComponent(id)}`);
      } catch  {
        failed++;
      }
    }
    setBulkDeleting(false);
    setConfirmBulk(false);
    setSelectedIds(new Set());
    setToast(
      failed === 0
        ? `${ids.length} record${ids.length === 1 ? "" : "s"} deleted.`
        : `${ids.length - failed} deleted, ${failed} could not be deleted.`
    );
    setTimeout(() => setToast(""), 3000);
    reload();
  };

  const handleDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    setDeletingId(row.id);
    try {
      await api.delete(`${resourceBase}/${encodeURIComponent(row.id)}`);
      setToast("Deleted successfully.");
      setTimeout(() => setToast(""), 2500);
      reload();
    } catch (err) {
      setToast(err.message || "Failed to delete.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  // A record number drawn as plain "link-looking" text (<span className="cell-link">)
  // is made a real link — to the detail page when there is one, else to the
  // edit page, else it opens the edit popup. Columns that already render
  // their own <Link> are left alone.
  const isPlainCellLink = (out) => isValidElement(out) && out.type === "span" && out.props.className === "cell-link";
  const linkedColumns = columns.map((col) => {
    if (!col.render || !addConfig) return col;
    return {
      ...col,
      render: (row) => {
        const out = col.render(row);
        if (!isPlainCellLink(out)) return out;
        if (detailHref) return <Link to={detailHref(row)} className="cell-link">{out.props.children}</Link>;
        if (!canEdit) return out;
        if (editHref) return <Link to={editHref(row)} className="cell-link" title="Open">{out.props.children}</Link>;
        return (
          <button type="button" className="cell-link cell-link-btn" title="Open" onClick={() => setEditingRow(row)}>
            {out.props.children}
          </button>
        );
      },
    };
  });

  const tableColumns = addConfig && (canEdit || canDelete)
    ? [
        ...linkedColumns,
        {
          key: "__actions",
          header: "Actions",
          render: (row) => (
            <div className="row-actions">
              {rowActions && rowActions(row)}
              {canEdit && (editHref ? (
                <Link to={editHref(row)} className="icon-btn" title="Edit"><Icon name="edit" /></Link>
              ) : (
                <button type="button" className="icon-btn" title="Edit" onClick={() => setEditingRow(row)}><Icon name="edit" /></button>
              ))}
              {canDelete && (
              <button
                type="button"
                className="icon-btn danger"
                title="Delete"
                onClick={() => setDeleteTarget(row)}
                disabled={deletingId === row.id}
              >
                <Icon name="trash" />
              </button>
              )}
            </div>
          ),
        },
      ]
    : linkedColumns;

  // Desktop table rows, filtered by the toolbar search across every value on
  // the row — same "filter what's loaded" approach the mobile card list below
  // already uses.
  const tableRows = tableSearch.trim()
    ? data.filter((row) => JSON.stringify(row).toLowerCase().includes(tableSearch.trim().toLowerCase()))
    : data;

  // Mobile card list: filtered client-side from the currently loaded page
  // (same live data the desktop table shows — nothing hardcoded).
  const mobileRows = data.filter((row) => {
    if (mobileTabs && mobileTab !== undefined && mobileTab !== null) {
      if (row[mobileTabs.field] !== mobileTab) return false;
    }
    if (!mobileSearch.trim()) return true;
    return JSON.stringify(row).toLowerCase().includes(mobileSearch.trim().toLowerCase());
  });

  const summary = mobileSummary ? mobileSummary(data, total) : null;

  return (
    <div>
      <PageHeader
        title={title}
        crumbs={crumbs}
        actions={
          <>
            <ExportButtons
              endpoint={endpoint}
              columns={columns}
              title={title}
              filenameBase={title.toLowerCase().replace(/\s+/g, "-")}
              params={params}
              empty={!loading && total === 0 && data.length === 0}
            />
            {extraActions}
            {canCreate && addConfig && addHref && (
              <Link to={addHref} className="btn btn-primary">
                {addConfig.buttonLabel}
              </Link>
            )}
            {canCreate && addConfig && !addHref && (
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                {addConfig.buttonLabel}
              </button>
            )}
          </>
        }
      />

      {note && (
        <div className="list-note">
          <Icon name="alertCircle" size={16} />
          <span>{note}</span>
        </div>
      )}

      <div className={`desktop-list-view card${tableStyle === "cards" ? " table-cards-mode" : ""}`}>
        <div className="table-toolbar">
          <div className="table-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder={`Search ${title.toLowerCase()} on this page...`}
              aria-label={`Search ${title} on this page`}
            />
            {tableSearch && (
              <button type="button" className="table-search-clear" onClick={() => setTableSearch("")} aria-label="Clear search" title="Clear search">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>

        {canDelete && selectedIds.size > 0 && (
          <div className="bulk-bar">
            <span>
              {selectedIds.size} selected on this page
            </span>
            <span className="bulk-spacer" />
            <button type="button" className="btn" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmBulk(true)}>
              <Icon name="trash" size={14} /> Delete selected
            </button>
          </div>
        )}

        <DataTable
          variant={tableStyle === "cards" ? "cards" : "classic"}
          columns={tableColumns}
          rows={tableRows}
          loading={loading}
          emptyText={tableSearch ? "No rows on this page match your search." : undefined}
          selectedIds={canDelete && addConfig ? selectedIds : undefined}
          onSelectionChange={canDelete && addConfig ? setSelectedIds : undefined}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          noun={title.toLowerCase()}
        />
      </div>

      <div className="mobile-list-view">
        <div className="m-search-row">
          <div className="m-search-input">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder={mobileSearchPlaceholder || `Search ${title.toLowerCase()}...`}
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
            />
          </div>
          <button type="button" className="m-filter-btn" aria-label="Filter"><Icon name="filter" size={17} /></button>
        </div>

        {mobileTabs && (
          <div className="m-tabs">
            {mobileTabs.options.map((opt) => {
              const count = data.filter((r) => opt.value === undefined || opt.value === null || r[mobileTabs.field] === opt.value).length;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  className={`m-tab ${mobileTab === opt.value ? "active" : ""}`}
                  onClick={() => setMobileTab(opt.value)}
                >
                  {opt.label} <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="loading-row"><Loader /></div>
        ) : mobileRows.length === 0 ? (
          <div className="loading-row">No records found.</div>
        ) : (
          mobileRows.map((row) =>
            mobileCard ? (
              <div key={row.id}>
                {mobileCard(row, {
                  onEdit: addConfig && canEdit ? (editHref ? () => navigate(editHref(row)) : () => setEditingRow(row)) : undefined,
                  onDelete: addConfig && canDelete ? () => setDeleteTarget(row) : undefined,
                })}
              </div>
            ) : (
              <GenericMobileCard
                key={row.id}
                row={row}
                columns={columns}
                onEdit={addConfig && canEdit ? (editHref ? () => navigate(editHref(row)) : () => setEditingRow(row)) : undefined}
                onDelete={addConfig && canDelete ? () => setDeleteTarget(row) : undefined}
              />
            )
          )
        )}

        {summary && (
          <div className="m-summary-card">
            <div className="m-summary-icon"><Icon name={summary.icon} size={20} /></div>
            <div>
              <div className="m-summary-title">{summary.title}</div>
              <div className="m-summary-sub">{summary.sub}</div>
            </div>
          </div>
        )}
      </div>

      {modalOpen && addConfig && !addHref && (
        <Modal title={addConfig.modalTitle || addConfig.buttonLabel} onClose={() => setModalOpen(false)}>
          <AddRecordForm fields={addConfig.fields} onSubmit={handleAdd} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {editingRow && addConfig && !editHref && (
        <Modal title={`Edit ${addConfig.modalTitle ? addConfig.modalTitle.replace(/^(Add|New) /, "") : "Record"}`} onClose={() => setEditingRow(null)}>
          <AddRecordForm
            fields={addConfig.fields}
            initialValues={addConfig.loadTransform ? addConfig.loadTransform(editingRow) : editingRow}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingRow(null)}
            submitLabel="Save Changes"
          />
        </Modal>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title="Delete selected records"
          message={`Delete ${selectedIds.size} selected record${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`}
          confirming={bulkDeleting}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulk(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete record"
          message={`Delete ${deleteTarget.id}? This cannot be undone.`}
          confirming={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
