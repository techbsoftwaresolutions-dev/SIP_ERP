import { Suspense, lazy } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import { EmbeddedContext } from "../../components/layout/EmbeddedContext";
import { usePermissions } from "../../context/PermissionsContext";

const TABS = [
  { key: "company", label: "Company", menu: "settings:company", Page: lazy(() => import("./Company")) },
  { key: "numbering", label: "Numbering", menu: "settings:numbering", Page: lazy(() => import("./Numbering")) },
  { key: "invoice-theme", label: "Invoice Theme", menu: "settings:invoice-theme", Page: lazy(() => import("./InvoiceTheme")) },
  { key: "general", label: "General", menu: "settings:general", Page: lazy(() => import("./General")) },
  { key: "email", label: "Email", menu: "settings:email", Page: lazy(() => import("./Email")) },
  { key: "whatsapp", label: "WhatsApp", menu: "settings:whatsapp", Page: lazy(() => import("./WhatsApp")) },
  { key: "tax", label: "Tax", menu: "settings:tax", Page: lazy(() => import("./Tax")) },
  { key: "backup", label: "Backup & Restore", menu: "settings:backup", Page: lazy(() => import("./Backup")) },
  { key: "custom-fields", label: "Custom Fields", menu: "settings:custom-fields", Page: lazy(() => import("./CustomFields")) },
];

export default function SettingsTabs() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const visible = TABS.filter((t) => can(t.menu, "view"));
  if (visible.length === 0) return <Navigate to="/dashboard" replace />;

  const active = visible.find((t) => t.key === tab);
  if (!active) return <Navigate to={`/settings/${visible[0].key}`} replace />;

  const { Page } = active;
  return (
    <div>
      <PageHeader title="Settings" crumbs={["Dashboard", "Settings", active.label]} />
      <div className="settings-tabs" role="tablist">
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active.key}
            className={`settings-tab${t.key === active.key ? " active" : ""}`}
            onClick={() => navigate(`/settings/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <EmbeddedContext.Provider value={true}>
        <Suspense fallback={<div className="loading-row"><Loader /></div>}>
          <Page key={active.key} />
        </Suspense>
      </EmbeddedContext.Provider>
    </div>
  );
}
