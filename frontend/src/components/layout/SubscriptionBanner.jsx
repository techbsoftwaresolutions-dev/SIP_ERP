import { useState } from "react";
import Icon from "../ui/Icon";
import { useSubscription } from "../../context/SubscriptionContext";

const WARN_WITHIN_DAYS = 7;

// Soft warning shown above the app when a subscription is close to lapsing.
// Dismissible for the rest of the page session.
export default function SubscriptionBanner() {
  const { state, daysRemaining, planName } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (state !== "active") return null;
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining > WARN_WITHIN_DAYS) return null;

  const when =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
        ? "tomorrow"
        : `in ${daysRemaining} days`;

  return (
    <div className="sub-banner">
      <Icon name="alertTriangle" size={15} />
      <span>
        Your {planName ? `${planName} ` : ""}subscription expires <strong>{when}</strong>. Contact
        TechB Software Solutions to renew.
      </span>
      <button type="button" className="sub-banner-close" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
