export const colors = {
  primary: "#2563eb",
  primaryBg: "#dbeafe",
  navy: "#12151f",
  orange: "#f97316",
  orangeDark: "#ea580c",
  orangeBg: "#ffedd5",
  teal: "#14b8a6",
  tealDark: "#0d9488",
  tealBg: "#ccfbf1",
  green: "#16a34a",
  greenBg: "#dcfce7",
  amber: "#d97706",
  amberBg: "#fef3c7",
  red: "#dc2626",
  redBg: "#fee2e2",
  blue: "#2563eb",
  blueBg: "#dbeafe",
  purple: "#7c3aed",
  purpleBg: "#ede9fe",
  gray: "#6b7280",
  grayBg: "#eef0f3",
  bg: "#f3f5f8",
  card: "#ffffff",
  border: "#e5e9ef",
  text: "#1f2937",
  textMuted: "#6b7280",
  textLight: "#9aa4b2",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 12;

// Status -> colour family, copied from the web StatusBadge so a status reads
// the same colour on both.
const STATUS_FAMILY = {
  Open: "green", Active: "green", Delivered: "green", Paid: "green", Approved: "green",
  Completed: "green", Accepted: "green", Confirmed: "green", Refunded: "green", Converted: "green",
  "In Stock": "green", Received: "green", Passed: "green", Success: "green", Full: "green",
  Available: "green",

  Pending: "amber", "Pending Approval": "amber", "Pending Dispatch": "amber", Draft: "amber",
  Sent: "amber", Scheduled: "amber", "In Progress": "amber", "In Transit": "amber",
  "In Discussion": "amber", "Partially Paid": "amber", New: "amber", Requested: "amber",
  "On Hold": "amber", "Low Stock": "amber", "Not Received": "amber", "Partially Accepted": "amber",
  "Inspection Pending": "amber", Partial: "amber", Warning: "amber", "Pending QC": "amber",
  "Expiring Soon": "amber", "Partially Dispatched": "amber", "Not Dispatched": "amber",

  Cancelled: "red", Failure: "red", Denied: "red", Rejected: "red", Failed: "red", Overdue: "red",
  Lost: "red", Unpaid: "red", Inactive: "red", Deactive: "red", Disabled: "red", Expired: "red",
  "Out of Stock": "red",

  Suspended: "purple",
};

export function statusColors(status) {
  const fam = STATUS_FAMILY[status] || "gray";
  return { fg: colors[fam === "gray" ? "gray" : fam], bg: colors[`${fam}Bg`] };
}

export const TILE_COLORS = ["blue", "green", "orange", "purple", "teal", "amber", "red"];
