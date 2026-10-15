import { useState } from "react";
import Icon from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Shown instead of the app when a client's subscription has expired or their
// account was suspended. Rendered from ProtectedRoute, so the sidebar/topbar
// (and their data fetches) never mount.
export default function SubscriptionBlocked() {
  const { state, planName, subscriptionEnd, companyName, message, refresh } = useSubscription();
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);

  const expiredOn = formatDate(subscriptionEnd);
  const suspended = state === "suspended";

  const check = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="sub-blocked-page">
      <div className="sub-blocked-card">
        <div className={`sub-blocked-icon ${suspended ? "suspended" : "expired"}`}>
          <Icon name={suspended ? "alertTriangle" : "alertCircle"} size={30} />
        </div>

        <h1>{suspended ? "Account suspended" : "Subscription expired"}</h1>
        <p className="sub-blocked-message">
          {message ||
            (suspended
              ? "This account has been suspended."
              : "This subscription is no longer active.")}
        </p>

        <div className="sub-blocked-facts">
          {companyName && (
            <div className="sub-blocked-fact">
              <span>Company</span>
              <strong>{companyName}</strong>
            </div>
          )}
          {planName && (
            <div className="sub-blocked-fact">
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>
          )}
          {expiredOn && !suspended && (
            <div className="sub-blocked-fact">
              <span>Expired on</span>
              <strong>{expiredOn}</strong>
            </div>
          )}
        </div>

        <p className="sub-blocked-contact">
          Contact <strong>TechB Software Solutions</strong> to {suspended ? "restore" : "renew"} access.
          Your data is safe and untouched.
        </p>

        <div className="sub-blocked-actions">
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
          <button type="button" className="btn btn-primary" onClick={check} disabled={checking}>
            {checking ? "Checking…" : "Check again"}
          </button>
        </div>
      </div>
    </div>
  );
}
