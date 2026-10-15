import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { STOCK_MOVE_ROLES } from "../../components/layout/Sidebar";
import Icon from "../../components/ui/Icon";

const GROUPS = [
  {
    label: "Assistant",
    items: [
      {
        title: "AI Assistant",
        sub: "Ask questions about your data",
        icon: "sparkles",
        color: "purple",
        to: "/ai/assistant",
        roles: ["Administrator"],
      },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Customers", sub: "Manage your customers", icon: "users", color: "purple", to: "/customers" },
      { title: "Suppliers", sub: "Manage your suppliers", icon: "truck", color: "orange", to: "/suppliers" },
      { title: "Products", sub: "Manage your products & categories", icon: "package", color: "green", to: "/products/items" },
    ],
  },
  {
    label: "Manufacturing",
    items: [
      { title: "Work Orders", sub: "Plan and track production runs", icon: "wrench", color: "blue", to: "/manufacturing/work-orders" },
      { title: "Bill of Materials", sub: "What each product is built from", icon: "package", color: "purple", to: "/manufacturing/boms" },
      { title: "Job Cards", sub: "Shop floor operation booking", icon: "tag", color: "orange", to: "/manufacturing/job-cards" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { title: "Purchase", sub: "Manage purchase orders and bills", icon: "cart", color: "blue", to: "/purchase/orders" },
      { title: "Sales", sub: "Manage sales orders and invoices", icon: "bag", color: "orange", to: "/sales/orders" },
      { title: "Returns", sub: "Manage sales returns", icon: "file", color: "green", to: "/sales/returns" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Inventory", sub: "Stock overview and adjustment", icon: "package", color: "purple", to: "/inventory" },
      { title: "Stock", sub: "Stock in and stock out", icon: "store", color: "orange", to: "/inventory/stock-in", roles: STOCK_MOVE_ROLES },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Reports", sub: "View all business reports", icon: "chart", color: "green", to: "/reports/sales" },
      { title: "Analytics", sub: "Business analytics and insights", icon: "trending", color: "red", to: "/reports/inventory" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", sub: "Manage users and permissions", icon: "user", color: "blue", to: "/users" },
      { title: "Audit Logs", sub: "Track all system activity", icon: "file", color: "red", to: "/users/audit-logs", roles: ["Administrator"] },
      { title: "Settings", sub: "Company and system settings", icon: "settings", color: "purple", to: "/settings" },
      { title: "My Subscription", sub: "See the plan you are on", icon: "wallet", color: "green", to: "/subscription" },
    ],
  },
];

const ICON_BG = {
  purple: { background: "var(--purple-bg)", color: "var(--purple)" },
  orange: { background: "var(--orange-bg)", color: "var(--orange-dark)" },
  green: { background: "var(--green-bg)", color: "var(--green-dark)" },
  blue: { background: "var(--blue-bg)", color: "var(--blue)" },
  red: { background: "var(--red-bg)", color: "var(--red)" },
};

export default function More() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifTotal, setNotifTotal] = useState(0);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    api.get("/api/activity-log?page=1&pageSize=1").then((r) => setNotifTotal(r.total || 0)).catch(() => {});
    api.get("/api/settings").then((s) => setAdminName(s?.adminName || "")).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="More"
        crumbs={["Dashboard", "More"]}
        actions={
          <>
            <button type="button" className="topbar-bell" aria-label="Notifications" style={{ position: "relative" }}>
              <Icon name="bell" size={18} />
              {notifTotal > 0 && <span className="badge" style={{ position: "absolute", top: -6, right: -8, background: "var(--amber)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 5px" }}>{notifTotal > 9 ? "9+" : notifTotal}</span>}
            </button>
            <button type="button" className="btn" onClick={() => navigate("/settings")}>
              <span className="topbar-avatar" style={{ width: 26, height: 26, fontSize: 13 }}>{user?.avatar || <Icon name="user" size={15} />}</span>
              {user?.name || adminName || "Admin"} <Icon name="chevronDown" size={13} />
            </button>
          </>
        }
      />

      {GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.roles || item.roles.includes(user?.role));
        if (items.length === 0) return null;
        return (
        <div className="more-group" key={group.label}>
          <div className="more-group-title">{group.label}</div>
          <div className="more-card">
            {items.map((item) => (
              <div key={item.title} className="more-tile" onClick={() => navigate(item.to)} role="button" tabIndex={0}>
                <div className="more-tile-icon" style={ICON_BG[item.color]}><Icon name={item.icon} size={19} /></div>
                <div>
                  <div className="more-tile-title">{item.title}</div>
                  <div className="more-tile-sub">{item.sub}</div>
                </div>
                <div className="more-tile-arrow">›</div>
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
