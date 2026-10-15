import { useEffect, useState } from "react";
import api, { readSwr } from "../api/client";

// The table template a business picked in Settings -> General -> Table Style.
//   "classic": the standard table (the default)
//   "cards":   each row drawn as its own soft card
export const TABLE_STYLE_OPTIONS = ["Classic Table", "Card Rows"];
export const DEFAULT_TABLE_STYLE = TABLE_STYLE_OPTIONS[0];

const toStyle = (settings) => (settings && settings.tableStyle === "Card Rows" ? "cards" : "classic");

// Returns "classic" or "cards". Starts from the cached settings so a page does
// not flash the wrong template, and updates the moment the setting is saved.
export default function useTableStyle() {
  const [style, setStyle] = useState(() => toStyle(readSwr("/api/settings")));

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.swr("/api/settings", (s) => alive && setStyle(toStyle(s))).catch(() => {});
    };
    load();
    window.addEventListener("table-style-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("table-style-changed", load);
    };
  }, []);

  return style;
}
