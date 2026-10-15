import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";
import SubscriptionBanner from "./SubscriptionBanner";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main-area">
        <Topbar onMenuClick={() => setMenuOpen((v) => !v)} />
        <SubscriptionBanner />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
