// Every surface mode the stylesheet defines (see the [data-theme] blocks in
// index.css). Which of these a given client is actually OFFERED is decided per
// brand in Theme Management — context/ThemeContext.jsx filters this list down
// to the modes the client's theme enables.
export const THEMES = [
    { id: "light", label: "Light", swatch: "#f3f5f8" },
    { id: "dark", label: "Dark", swatch: "#0f1219" },
    { id: "sepia", label: "Sepia", swatch: "#f4ecd8" },
];

// Used only as a last resort: a brand always carries its own default mode.
export const DEFAULT_THEME = "light";
