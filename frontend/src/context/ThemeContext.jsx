import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEMES } from "../config/themes";
import api from "../api/client";
import { applyThemeTokens, DEFAULT_THEME } from "../utils/themeTokens";

const ThemeContext = createContext();

// Two separate things are called "theme" here, so to be exact:
//
//   the BRAND  — colours set by a super admin in Theme Management, fetched
//                from /api/theme and painted as CSS custom properties. The
//                client does not choose this.
//   the MODE   — light / dark / sepia, which the signed-in user picks from the
//                topbar. The brand decides which modes are on offer and which
//                one a client starts on.
const STORAGE_KEY = "theme";

function storedMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch (_) {
    // Private windows and blocked site data both throw here.
    return "";
  }
}

export function ThemeProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT_THEME);
  // Empty until either storage or the brand's default decides — resolved in
  // the effect below, so the first paint is not a flash of the wrong mode.
  const [mode, setModeState] = useState(() => storedMode());

  // Paint the shipped colours immediately, then repaint when the real brand
  // arrives. If the call fails the app keeps the stock look rather than
  // rendering unstyled.
  useEffect(() => {
    applyThemeTokens(DEFAULT_THEME);
    let cancelled = false;
    api
      .get("/api/theme")
      .then((t) => {
        if (cancelled) return;
        setBrand(t);
        applyThemeTokens(t);
      })
      .catch(() => {
        /* stock look already applied */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modes = useMemo(() => {
    const allowed = new Set(brand.modes && brand.modes.length ? brand.modes : ["light"]);
    return THEMES.filter((t) => allowed.has(t.id));
  }, [brand]);

  // The mode actually in force: the user's choice when the brand still offers
  // it, otherwise the brand's default. A brand that drops dark must not leave
  // a client stuck on a mode it no longer defines.
  const activeMode = useMemo(() => {
    const ids = modes.map((m) => m.id);
    if (mode && ids.includes(mode)) return mode;
    if (ids.includes(brand.defaultMode)) return brand.defaultMode;
    return ids[0] || "light";
  }, [mode, modes, brand]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeMode);
  }, [activeMode]);

  const setTheme = (next) => {
    if (!modes.some((m) => m.id === next)) return;
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {
      // Remembering the choice is a convenience; failing to is not an error.
    }
  };

  const value = useMemo(
    () => ({ theme: activeMode, setTheme, themes: modes, brand }),
    [activeMode, modes, brand]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
