// Monochrome inline SVG icon set. Every glyph is drawn with `currentColor`,
// so an icon picks up the color of the text around it and therefore flips
// with the active theme (near-black on light, near-white on dark) without any
// per-theme asset or JS. Replaces the emoji glyphs that used to be sprinkled
// through the UI, which rendered in fixed OS colors and ignored the theme.

const PATHS = {
  home: (
    <>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5.4 9v11h13.2V9" />
      <path d="M9.6 20v-6h4.8v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.6 19.8c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6" />
      <path d="M16.4 5.1a3.4 3.4 0 0 1 0 5.8" />
      <path d="M18.2 14.6c2 .8 3.2 2.6 3.2 5.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h10.5v9H2.5z" />
      <path d="M13 10h3.7l3.3 3.2v2.3H13z" />
      <circle cx="7" cy="18" r="1.9" />
      <circle cx="17" cy="18" r="1.9" />
    </>
  ),
  package: (
    <>
      <path d="M20.5 7.8v8.4L12 21l-8.5-4.8V7.8L12 3z" />
      <path d="M3.5 7.8 12 12.6l8.5-4.8" />
      <path d="M12 12.6V21" />
    </>
  ),
  cart: (
    <>
      <path d="M2.5 3.6h2.6l2.7 11.1h9.6" />
      <path d="M6.6 6.9h14.9l-1.9 6.5H8.2" />
      <circle cx="9.2" cy="19.4" r="1.6" />
      <circle cx="17.6" cy="19.4" r="1.6" />
    </>
  ),
  bag: (
    <>
      <path d="M5.4 7.6h13.2l1.1 11.2a1.8 1.8 0 0 1-1.8 2H6.1a1.8 1.8 0 0 1-1.8-2z" />
      <path d="M8.8 10V7a3.2 3.2 0 0 1 6.4 0v3" />
    </>
  ),
  store: (
    <>
      <path d="M2.4 9.6 4.6 4.2h14.8l2.2 5.4z" />
      <path d="M4 9.6v10.2h16V9.6" />
      <path d="M9.4 19.8v-5.9h5.2v5.9" />
      <path d="M8.9 4.2 7.7 9.6" />
      <path d="M15.1 4.2l1.2 5.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10.5" />
      <path d="M9.3 20V4.5" />
      <path d="M14.7 20v-7" />
      <path d="M20 20V8" />
    </>
  ),
  trending: (
    <>
      <path d="M3 16.5 9.2 10.3l3.8 3.8L21 6.2" />
      <path d="M15.4 6.2H21v5.6" />
    </>
  ),
  // Two overlapping coins, not a stack of ellipses — an ellipse stack reads as
  // a database at nav-icon size.
  coins: (
    <>
      <circle cx="8.6" cy="8.6" r="5.4" />
      <circle cx="15.4" cy="15.4" r="5.4" />
      <path d="M8.6 6.2v4.8" />
      <path d="M13 15.4h4.8" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 9.4v5.2" />
      <path d="M18 9.4v5.2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5v2.5" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.2" />
      <path d="M20.5 11.5h-3.8a2.3 2.3 0 0 0 0 4.6h3.8" />
    </>
  ),
  tag: (
    <>
      <path d="M11 3.5H4.5a1 1 0 0 0-1 1V11a2 2 0 0 0 .6 1.4l7.6 7.6a2 2 0 0 0 2.8 0l6.1-6.1a2 2 0 0 0 0-2.8l-7.6-7.6A2 2 0 0 0 11 3.5z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </>
  ),
  file: (
    <>
      <path d="M13.6 3.5H7.2a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.9z" />
      <path d="M13.6 3.5v5.4h5.2" />
      <path d="M8.6 13h6.8" />
      <path d="M8.6 16.6h4.6" />
    </>
  ),
  // Sliders rather than a gear: an 8-tooth cog turns to mush at the 15-17px
  // this is drawn at, while three tracks and a knob stay legible.
  settings: (
    <>
      <path d="M3.6 6.6h8.2" />
      <path d="M16.4 6.6h4" />
      <path d="M3.6 12h3" />
      <path d="M11 12h9.4" />
      <path d="M3.6 17.4h8.2" />
      <path d="M16.4 17.4h4" />
      <circle cx="14.1" cy="6.6" r="2.3" />
      <circle cx="8.7" cy="12" r="2.3" />
      <circle cx="14.1" cy="17.4" r="2.3" />
    </>
  ),
  wrench: (
    <path d="M20.4 5.6 17.6 8.4a2 2 0 0 1-2.8-2.8l2.8-2.8a5 5 0 0 0-6.4 6.2L3.9 16.3a2.3 2.3 0 0 0 3.2 3.2l7.3-7.3a5 5 0 0 0 6-6.6z" />
  ),
  edit: (
    <>
      <path d="M4 16.4 16.1 4.3a2.55 2.55 0 0 1 3.6 3.6L7.6 20H4z" />
      <path d="M14.4 6l3.6 3.6" />
    </>
  ),
  trash: (
    <>
      <path d="M3.8 6.3h16.4" />
      <path d="M9.2 6.3V4.5c0-.6.5-1.1 1.1-1.1h3.4c.6 0 1.1.5 1.1 1.1v1.8" />
      <path d="M6 6.3l.9 13a1.7 1.7 0 0 0 1.7 1.6h6.8a1.7 1.7 0 0 0 1.7-1.6l.9-13" />
      <path d="M10.2 10.4v6.6" />
      <path d="M13.8 10.4v6.6" />
    </>
  ),
  check: <path d="M4.8 12.4l4.9 4.9L19.2 6.7" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16.2V3.8" />
      <path d="M7.2 8.6 12 3.8l4.8 4.8" />
      <path d="M4 15.6v3.1c0 1 .8 1.8 1.8 1.8h12.4c1 0 1.8-.8 1.8-1.8v-3.1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.8v12.4" />
      <path d="M7.2 11.4 12 16.2l4.8-4.8" />
      <path d="M4 16.8v1.9c0 1 .8 1.8 1.8 1.8h12.4c1 0 1.8-.8 1.8-1.8v-1.9" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M20 20l-4.7-4.7" />
    </>
  ),
  filter: (
    <>
      <path d="M3.5 6h17" />
      <path d="M6.5 12h11" />
      <path d="M9.5 18h5" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="5.2" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18.8" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.2" width="17" height="15.3" rx="2.2" />
      <path d="M3.5 10h17" />
      <path d="M8 3.4v3.6" />
      <path d="M16 3.4v3.6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9.2a6 6 0 1 0-12 0c0 5.3-2 6.8-2 6.8h16s-2-1.5-2-6.8z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </>
  ),
  image: (
    <>
      <rect x="3.2" y="4.8" width="17.6" height="14.4" rx="2.2" />
      <circle cx="8.7" cy="10" r="1.7" />
      <path d="M20.8 15.6 16 11l-8.6 8.2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.3 0 2.1-.9 2.1-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2A5.4 5.4 0 0 0 22 8.7C21.3 5.5 17.1 3.2 12 3.2z" />
      <circle cx="7.6" cy="12.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4.5h3.2A1.8 1.8 0 0 1 20 6.3v11.4a1.8 1.8 0 0 1-1.8 1.8H15" />
      <path d="M10.2 8 6.2 12l4 4" />
      <path d="M6.2 12h9.2" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.5 12H5" />
      <path d="M11 6 5 12l6 6" />
    </>
  ),
  phone: (
    <path d="M7.4 3.8H4.9A1.9 1.9 0 0 0 3 5.8C3 13.7 10.3 21 18.2 21a1.9 1.9 0 0 0 1.9-1.9v-2.5l-4.3-1.7-1.9 2.3a13.7 13.7 0 0 1-6.1-6.1l2.3-1.9z" />
  ),
  mail: (
    <>
      <rect x="3" y="5.2" width="18" height="13.6" rx="2.2" />
      <path d="M3.6 7 12 13l8.4-6" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.2A8.5 8.5 0 1 0 12 3.5z" />
      <path
        d="M8.7 8.4c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4.2.4.6 1.4.7 1.5.1.1.1.3 0 .4-.1.2-.2.3-.3.5-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.5 1.5.3.1.5.1.7-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.6.3.1.2.1.9-.2 1.7-.3.8-1.7 1.5-2.3 1.5-.6 0-1.4.1-4.5-1.9-3.1-1.9-3.9-4-4-4.3-.1-.3-.9-1.5-.9-2.9 0-1.4.7-2.1 1-2.4z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="M8.3 10.6 15.7 7M8.3 13.4l7.4 3.6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5c.6 2.8 1.7 3.9 4.5 4.5-2.8.6-3.9 1.7-4.5 4.5-.6-2.8-1.7-3.9-4.5-4.5 2.8-.6 3.9-1.7 4.5-4.5z" />
      <path d="M18 13.5c.35 1.6 1 2.25 2.6 2.6-1.6.35-2.25 1-2.6 2.6-.35-1.6-1-2.25-2.6-2.6 1.6-.35 2.25-1 2.6-2.6z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.2 12S5.8 5.8 12 5.8 21.8 12 21.8 12 18.2 18.2 12 18.2 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.9A9.5 9.5 0 0 1 12 5.7c6.2 0 9.8 6.3 9.8 6.3a17 17 0 0 1-3.3 4.1" />
      <path d="M6.3 7.9A16.6 16.6 0 0 0 2.2 12s3.6 6.2 9.8 6.2a9.4 9.4 0 0 0 3.9-.8" />
      <path d="M10 10a2.9 2.9 0 0 0 4 4" />
      <path d="M3.5 3.5 20.5 20.5" />
    </>
  ),
  printer: (
    <>
      <path d="M6.8 8.8V3.8h10.4v5" />
      <rect x="3.2" y="8.8" width="17.6" height="7.4" rx="2" />
      <path d="M6.8 13.4h10.4v6.8H6.8z" />
    </>
  ),
  chevronDown: <path d="M6 9.5 12 15.5 18 9.5" />,
  chevronUp: <path d="M6 14.5 12 8.5 18 14.5" />,
  chevronRight: <path d="M9.5 6 15.5 12 9.5 18" />,
  chevronLeft: <path d="M14.5 6 8.5 12 14.5 18" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8.2 12.2l2.6 2.6 5-5.4" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.6v5" />
      <circle cx="12" cy="16.2" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3.9 21.3 19.6H2.7z" />
      <path d="M12 9.6v4.2" />
      <circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.2 9.2l5.6 5.6" />
      <path d="M14.8 9.2l-5.6 5.6" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7 9v6" />
      <path d="M10.3 9v6" />
      <path d="M13 9v6" />
      <path d="M16 9v6" />
      <path d="M17.8 9v6" />
    </>
  ),
};

export default function Icon({ name, size = 16, title, className = "", ...rest }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={`app-icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}
