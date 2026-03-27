import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "openrag_theme_preference";

export function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Single source of truth: toggle `dark` on <html> only (fixes “stuck on light” bugs from mixed class strategies). */
export function applyThemeToDocument(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveIsDark(pref));
}

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Resolved for UI labels */
  resolvedDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined" ? "system" : readStoredTheme(),
  );
  const [resolvedDark, setResolvedDark] = useState(() =>
    typeof window === "undefined" ? false : resolveIsDark(readStoredTheme()),
  );

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    applyThemeToDocument(p);
    setResolvedDark(resolveIsDark(p));
  }, []);

  useEffect(() => {
    applyThemeToDocument(preference);
    setResolvedDark(resolveIsDark(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemeToDocument("system");
      setResolvedDark(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, setPreference, resolvedDark }),
    [preference, setPreference, resolvedDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useThemeMode must be used within ThemeProvider");
  return c;
}
