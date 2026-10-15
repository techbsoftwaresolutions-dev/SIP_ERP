// Icon-only loading indicator — no "Loading..." text. Two sizes:
//   default  — a whole page/panel/card is loading (e.g. a detail page before
//              its data arrives, a route's Suspense fallback)
//   small    — a tight space is loading (a table's own body, an inline
//              status), sized to sit on one line without pushing layout
export default function Loader({ small = false, className = "" }) {
  return (
    <span
      className={`app-loader${small ? " app-loader-sm" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
        <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
