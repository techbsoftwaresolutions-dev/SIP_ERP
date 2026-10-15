// Single source of truth for "is this client allowed to use the app right now".
// Used by the tenant middleware in server.js (to block requests) and by
// GET /api/subscription/status (to tell the frontend why).

const DAY_MS = 24 * 60 * 60 * 1000;

// States:
//   "none"      no tenant row — unknown subdomain, localhost dev, curl.
//               Never blocked; behaves exactly as the app did before plans.
//   "active"    tenant exists and is within its subscription (or has no end date).
//   "expired"   subscriptionEnd (+ graceDays) has passed.
//   "suspended" manually switched off in Manage Clients.
function evaluateSubscription(tenant) {
  if (!tenant) {
    return { state: "none", planName: "", subscriptionEnd: null, daysRemaining: null, companyName: "" };
  }

  const base = {
    planName: tenant.planName || "",
    planCode: tenant.planCode || "",
    subscriptionEnd: tenant.subscriptionEnd || null,
    companyName: tenant.companyName || "",
  };

  if (tenant.status === "suspended") {
    return { ...base, state: "suspended", daysRemaining: null };
  }

  // No end date means an open-ended subscription — nothing to expire.
  if (!tenant.subscriptionEnd) {
    return { ...base, state: "active", daysRemaining: null };
  }

  const end = new Date(tenant.subscriptionEnd);
  // The subscription covers the whole of its last day.
  end.setHours(23, 59, 59, 999);
  const graceMs = (Number(tenant.graceDays) || 0) * DAY_MS;
  const deadline = end.getTime() + graceMs;
  const now = Date.now();

  if (now > deadline) {
    return { ...base, state: "expired", daysRemaining: 0 };
  }

  return {
    ...base,
    state: "active",
    daysRemaining: Math.max(0, Math.ceil((end.getTime() - now) / DAY_MS)),
  };
}

function isBlocked(subscription) {
  return subscription.state === "expired" || subscription.state === "suspended";
}

// The user-facing sentence shown on the block screen and the login error.
function blockedMessage(subscription) {
  const who = subscription.companyName ? `${subscription.companyName}'s` : "This";
  if (subscription.state === "suspended") {
    return `${who} account has been suspended. Please contact TechB Software Solutions.`;
  }
  const on = subscription.subscriptionEnd
    ? ` on ${new Date(subscription.subscriptionEnd).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`
    : "";
  return `${who} subscription expired${on}. Please contact TechB Software Solutions to renew.`;
}

module.exports = { evaluateSubscription, isBlocked, blockedMessage };
