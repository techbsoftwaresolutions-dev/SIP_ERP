import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminAccountModal from "./AdminAccountModal";

// Platform control-plane menu. Deliberately flat and short for now — the rest
// of the architecture (Vendors, Features, Approval Engine, Notifications,
// System Security) gets added a step at a time rather than as dead
// placeholder screens.
//
// Order follows how the pieces stack: Modules is the catalogue of what the
// platform can do, Plans and Add-ons are the two ways it is sold, Clients is
// who bought what.
const ADMIN_NAV = [
  { label: "Dashboard", icon: "home", to: "/admin" , end: true },
  { label: "Clients", icon: "users", to: "/admin/clients" },
  { label: "Modules", icon: "package", to: "/admin/modules" },
  { label: "Subscription Plans", icon: "tag", to: "/admin/plans" },
  { label: "Add-ons", icon: "sparkles", to: "/admin/add-ons" },
  { label: "Menu Management", icon: "menu", to: "/admin/menus" },
  { label: "Theme Management", icon: "palette", to: "/admin/themes" },
  { label: "Invoice Templates", icon: "printer", to: "/admin/invoice-templates" },
  { label: "Payment Methods", icon: "wallet", to: "/admin/payment-methods" },
  { label: "Approval Engine", icon: "checkCircle", to: "/admin/approval-rules" },
  { label: "Notifications", icon: "bell", to: "/admin/notifications" },
  { label: "Global Roles", icon: "users", to: "/admin/global-roles" },
  { label: "Global Permissions", icon: "lock", to: "/admin/global-permissions" },
  { label: "Demo Requests", icon: "mail", to: "/admin/demo-requests" },
  { label: "Audit Log", icon: "file", to: "/admin/audit-log" },
  { label: "Super Admins", icon: "user", to: "/admin/super-admins" },
  { label: "Sessions", icon: "lock", to: "/admin/sessions" },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="app-shell admin-shell">
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar admin-sidebar ${open ? "mobile-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <img src="/logo-mark.png" alt="SIPERP" />
          </span>
          <span className="admin-brand-text">
            SIPERP Admin
            <span className="admin-brand-sub">Control Plane</span>
          </span>
          <button type="button" className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="icon">
                <Icon name={item.icon} size={17} />
              </span>
              <span title={item.label}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* A standing reminder of which surface you're on: it is genuinely
            easy to forget that actions here reach every client at once. */}
        <div className="admin-sidebar-foot">
          <Icon name="alertTriangle" size={14} />
          <span>Changes here affect all clients</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar admin-topbar">
          <button type="button" className="topbar-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="admin-topbar-title">Platform Administration</div>
          <div className="topbar-right">
            <a href="/dashboard" className="btn admin-exit-btn" title="Open the client application">
              <Icon name="arrowLeft" size={14} /> Client App
            </a>
            <button
              type="button"
              className="admin-user"
              onClick={() => setAccountOpen(true)}
              title="Account settings"
            >
              <div className="topbar-avatar">
                <Icon name="user" size={18} />
              </div>
              <div>
                <div className="topbar-user-name">{admin?.name || "Admin"}</div>
                <div className="topbar-user-role">{admin?.role === "owner" ? "Owner" : "Operator"}</div>
              </div>
            </button>
            <button type="button" className="btn admin-logout-btn" onClick={handleLogout} title="Sign out">
              <Icon name="logout" size={15} /> Logout
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {accountOpen && <AdminAccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
