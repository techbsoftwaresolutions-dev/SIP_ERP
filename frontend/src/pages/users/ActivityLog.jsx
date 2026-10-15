import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import StatCard from "../../components/ui/StatCard";
import DataTable from "../../components/data/DataTable";
import Pagination from "../../components/data/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import Icon from "../../components/ui/Icon";
import ExportButtons from "../../components/data/ExportButtons";
import usePaginatedData from "../../hooks/usePaginatedData";
import DateInput from "../../components/forms/DateInput";
import Select from "../../components/forms/Select";

const PAGE_SIZE = 10;

const DEFAULT_FILTERS = {
  search: "",
  user: "all",
  role: "all",
  module: "all",
  action: "all",
  status: "all",
  ip: "",
  dateFrom: "",
  dateTo: "",
};

// Used until /filter-options responds (or if it isn't available yet).
const FALLBACK_MODULES = [
  "Authentication",
  "Customers",
  "Suppliers",
  "Inventory",
  "Purchase",
  "Sales",
  "Invoices",
  "Reports",
  "Users & Roles",
  "Settings",
  "AI Assistant",
];
const FALLBACK_ACTIONS = [
  "Login",
  "Logout",
  "Failed Login",
  "Create",
  "Update",
  "Delete",
  "Export",
  "Password Changed",
  "Role Changed",
  "User Updated",
  "User Deleted",
  "Company Settings Changed",
];

// Action → an existing .badge-* colour, so no new CSS is needed.
const ACTION_COLOR = {
  Login: "blue",
  Logout: "gray",
  "Failed Login": "red",
  Create: "green",
  Update: "amber",
  Delete: "red",
  "User Deleted": "red",
  Export: "purple",
  "Password Changed": "purple",
  "Role Changed": "purple",
  "Permission Changed": "purple",
  "User Updated": "amber",
  "Company Settings Changed": "amber",
};

function formatDateTime(row) {
  if (!row.createdAt) return row.date || "—";
  const d = new Date(row.createdAt);
  if (Number.isNaN(d.getTime())) return row.date || "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const detailsOf = (row) => row.description || row.details || "—";

function ActionChip({ action }) {
  return <span className={`badge badge-${ACTION_COLOR[action] || "gray"}`}>{action || "—"}</span>;
}

// Field-by-field comparison for update rows.
function BeforeAfter({ before, after }) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  if (keys.length === 0) return null;
  const show = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };
  return (
    <>
      <div className="section-title" style={{ marginTop: 22 }}>Changed Values</div>
      <div className="items-table-wrap">
        <table className="items-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td style={{ fontWeight: 600 }}>{k}</td>
                <td style={{ color: "var(--red)" }}>{show(before && before[k])}</td>
                <td style={{ color: "var(--green-dark)" }}>{show(after && after[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetailsModal({ row, onClose }) {
  const field = (label, value) => (
    <div className="detail-field">
      <label>{label}</label>
      <div className="detail-value">{value || "—"}</div>
    </div>
  );
  return (
    <div className="txn-modal">
      <Modal title={`Audit Log — ${row.id}`} onClose={onClose}>
        <div className="detail-grid">
          {field("Activity ID", row.id)}
          {field("Date & Time", formatDateTime(row))}
          {field("User", row.user)}
          {field("Role", row.role)}
          {field("Action", <ActionChip action={row.action} />)}
          {field("Module", row.module)}
          {field("Status", <StatusBadge status={row.status || "Success"} />)}
          {field("Record", [row.entityType, row.entityId].filter(Boolean).join(" ") || "—")}
          {field("IP Address", row.ip)}
          {field("Device", row.device)}
          {field("Location", row.location)}
          {field("Request", [row.method, row.path].filter(Boolean).join(" ") || "—")}
          <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <div className="detail-value">{detailsOf(row)}</div>
          </div>
        </div>
        {(row.before || row.after) && <BeforeAfter before={row.before} after={row.after} />}
      </Modal>
    </div>
  );
}

export default function AuditLogs() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ users: [], roles: [], modules: [], actions: [] });
  const [selected, setSelected] = useState(null);
  // Filters stay out of the way until asked for.
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Both endpoints are new — if the backend hasn't been deployed yet the
    // page still works, just without counts and with fallback dropdowns.
    api.get("/api/activity-log/summary").then(setSummary).catch(() => setSummary(null));
    api
      .get("/api/activity-log/filter-options")
      .then((o) => setOptions(o || {}))
      .catch(() => {});
  }, []);

  const { data: rows, page, setPage, total, totalPages, loading } = usePaginatedData("/api/activity-log", {
    pageSize: PAGE_SIZE,
    params: appliedFilters,
  });

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const applyFilters = () => setAppliedFilters(filters);
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const modules = options.modules?.length ? options.modules : FALLBACK_MODULES;
  const actions = options.actions?.length ? options.actions : FALLBACK_ACTIONS;

  // How many filters are actually narrowing the list right now — surfaced on
  // the Filters button so a hidden panel can't quietly hide an active filter.
  const activeCount = Object.keys(DEFAULT_FILTERS).filter(
    (k) => appliedFilters[k] !== DEFAULT_FILTERS[k]
  ).length;

  const columns = [
    {
      key: "createdAt",
      header: "Date & Time",
      render: formatDateTime,
      exportValue: formatDateTime,
    },
    {
      key: "user",
      header: "User",
      render: (r) => (
        <div>
          <div className="cell-primary">{r.user || "—"}</div>
          {r.role && <div className="cell-sub">{r.role}</div>}
        </div>
      ),
      exportValue: (r) => r.user || "",
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <ActionChip action={r.action} />,
      exportValue: (r) => r.action || "",
    },
    { key: "module", header: "Module", render: (r) => r.module || "—" },
    {
      key: "description",
      header: "Details",
      render: (r) => (
        <span className="cell-truncate" title={detailsOf(r)}>
          {detailsOf(r)}
        </span>
      ),
      exportValue: detailsOf,
    },
    { key: "ip", header: "IP Address", render: (r) => r.ip || "—" },
    {
      key: "device",
      header: "Device",
      render: (r) => (
        <span className="cell-truncate" title={r.device || ""}>
          {r.device || "—"}
        </span>
      ),
      exportValue: (r) => r.device || "",
    },
    { key: "location", header: "Location", render: (r) => r.location || "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status || "Success"} />,
      exportValue: (r) => r.status || "Success",
    },
    {
      key: "__view",
      header: "",
      sortable: false,
      render: (r) => (
        <button type="button" className="icon-btn" title="View full details" onClick={() => setSelected(r)}>
          <Icon name="eye" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        crumbs={["Dashboard", "Users & Roles", "Audit Logs"]}
        actions={
          <>
            <button
              type="button"
              className={`btn filter-toggle-btn${showFilters ? " active" : ""}`}
              title={showFilters ? "Hide filters" : "Show filters"}
              onClick={() => setShowFilters((s) => !s)}
            >
              <Icon name="filter" size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <ExportButtons
              endpoint="/api/activity-log"
              columns={columns}
              title="Audit Logs"
              filenameBase="audit-logs"
              params={appliedFilters}
            />
          </>
        }
      />

      <div className="stat-grid stat-grid-5">
        <StatCard icon="file" tone="blue" label="Total Logs" value={summary ? summary.total : "—"} />
        <StatCard icon="user" tone="teal" label="User Actions" value={summary ? summary.userActions : "—"} />
        <StatCard icon="settings" tone="green" label="System Events" value={summary ? summary.systemEvents : "—"} />
        <StatCard icon="lock" tone="amber" label="Security Events" value={summary ? summary.securityEvents : "—"} />
        <StatCard icon="xCircle" tone="red" label="Failed Attempts" value={summary ? summary.failedAttempts : "—"} />
      </div>

      {/* Hidden until the "Filters" button is used. The filter fields scroll
          horizontally on narrow screens; Apply/Reset stay outside that box so
          nothing gets clipped. */}
      {showFilters && (
      <div className="filter-bar" style={{ gap: 10, alignItems: "flex-end" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            overflowX: "auto",
            flex: "1 1 auto",
            minWidth: 0,
            paddingBottom: 2,
          }}
        >
          <div className="filter-field" style={{ minWidth: 170 }}>
            <label>Search</label>
            <input
              type="text"
              placeholder="User, action, record, IP…"
              value={filters.search}
              onChange={set("search")}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="filter-field" style={{ minWidth: 130 }}>
            <label>From</label>
            <DateInput value={filters.dateFrom} onChange={set("dateFrom")} />
          </div>
          <div className="filter-field" style={{ minWidth: 130 }}>
            <label>To</label>
            <DateInput value={filters.dateTo} onChange={set("dateTo")} />
          </div>
          <div className="filter-field" style={{ minWidth: 120 }}>
            <label>User</label>
            <Select value={filters.user} onChange={set("user")}>
              <option value="all">All Users</option>
              {(options.users || []).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field" style={{ minWidth: 120 }}>
            <label>Role</label>
            <Select value={filters.role} onChange={set("role")}>
              <option value="all">All Roles</option>
              {(options.roles || []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field" style={{ minWidth: 130 }}>
            <label>Module</label>
            <Select value={filters.module} onChange={set("module")}>
              <option value="all">All Modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field" style={{ minWidth: 130 }}>
            <label>Action</label>
            <Select value={filters.action} onChange={set("action")}>
              <option value="all">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field" style={{ minWidth: 110 }}>
            <label>Status</label>
            <Select value={filters.status} onChange={set("status")}>
              <option value="all">All Status</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Warning">Warning</option>
            </Select>
          </div>
          <div className="filter-field" style={{ minWidth: 130 }}>
            <label>IP Address</label>
            <input
              type="text"
              placeholder="e.g. 103.87."
              value={filters.ip}
              onChange={set("ip")}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
        </div>
        <button className="filter-apply-btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={applyFilters}>
          Apply Filters
        </button>
        <button className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={resetFilters}>
          Reset
        </button>
      </div>
      )}

      <div className="card">
        <DataTable columns={columns} rows={rows} loading={loading} emptyText="No audit entries match these filters." />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {selected && <DetailsModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
