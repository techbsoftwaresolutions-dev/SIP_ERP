import Icon from "./Icon";

// A summary figure. The plain form is just a label and a value.
//
// Give it an `icon` for the rich, tinted card used on the redesigned list pages:
//   icon: an Icon name        tone: "blue" | "green" | "purple" | "amber" | "red"
//   note: a short line under the value (shown as a small chip)
export default function StatCard({ label, value, color, icon, tone = "blue", note }) {
  if (!icon) {
    return (
      <div className="stat-card">
        <div className="label">{label}</div>
        <div className={`value ${color || ""}`}>{value}</div>
      </div>
    );
  }
  return (
    <div className={`stat-card stat-rich tone-${tone}`}>
      <span className="stat-rich-icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="stat-rich-body">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {note ? <span className="stat-rich-note">{note}</span> : null}
      </div>
      <span className="stat-rich-glow" aria-hidden="true" />
    </div>
  );
}
