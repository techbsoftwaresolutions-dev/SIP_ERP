// Avatar + name, for table columns that hold a person (owner, operator,
// supervisor, issued-by). Renders an em dash when there is no name, so an
// empty optional field doesn't show a blank circle.

// Fixed palette, picked by hashing the name — the same person keeps the same
// color on every screen and across reloads, without storing anything.
const COLORS = ["#2563eb", "#7c3aed", "#0d9488", "#d97706", "#db2777", "#16a34a", "#4f46e5", "#ea580c"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

// "Ravi K" -> "RK", "TechB Sales" -> "TS", "Anita" -> "AN".
function initialsFor(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function UserCell({ name, fallback = "—" }) {
  const clean = String(name || "").trim();
  if (!clean) return <span style={{ color: "var(--text-light)" }}>{fallback}</span>;

  return (
    <span className="cell-user">
      <span className="cell-avatar" style={{ background: colorFor(clean) }} aria-hidden="true">
        {initialsFor(clean)}
      </span>
      <span>{clean}</span>
    </span>
  );
}
