import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon";

const TABS = [
  { label: "Dashboard", icon: "home", to: "/dashboard" },
  { label: "Customers", icon: "users", to: "/customers" },
  { label: "Products", icon: "package", to: "/products/items" },
  { label: "Sales", icon: "bag", to: "/sales" },
  { label: "More", icon: "ellipsis", to: "/more" },
];

// Bottom tab bar shown only on mobile-width screens (see .mobile-bottom-nav
// in index.css). Mirrors the sidebar's top-level sections so every page is
// still reachable without the desktop sidebar.
export default function MobileNav() {
  return (
    <nav className="mobile-bottom-nav">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}
        >
          <span className="mobile-nav-icon"><Icon name={tab.icon} size={20} /></span>
          <span className="mobile-nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
