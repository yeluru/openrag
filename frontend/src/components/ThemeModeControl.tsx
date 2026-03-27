import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/theme/ThemeContext";

type Props = {
  className?: string;
  /** Smaller hit targets for dense headers */
  compact?: boolean;
};

export function ThemeModeControl({ className = "", compact }: Props) {
  const { setPreference, resolvedDark } = useThemeMode();

  const toggle = () => setPreference(resolvedDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      title={resolvedDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={resolvedDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex items-center justify-center rounded-xl border border-[var(--or-border)] bg-[var(--or-surface-muted)] text-[var(--or-ink)] shadow-sm transition-colors hover:bg-[var(--or-cream)] hover:ring-1 hover:ring-[var(--or-border)] dark:hover:bg-[var(--or-surface-inset)] ${
        compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11"
      } ${className}`}
    >
      {resolvedDark ? (
        <Sun className={compact ? "h-4 w-4" : "h-[18px] w-[18px] sm:h-5 sm:w-5"} aria-hidden />
      ) : (
        <Moon className={compact ? "h-4 w-4" : "h-[18px] w-[18px] sm:h-5 sm:w-5"} aria-hidden />
      )}
    </button>
  );
}
