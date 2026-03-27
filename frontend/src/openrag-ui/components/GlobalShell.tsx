import { motion } from "framer-motion";
import {
  BookOpen,
  Highlighter,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeModeControl } from "@/components/ThemeModeControl";
import { useOpenRAG } from "../context/OpenRAGContext";
import type { AppView } from "../types";

const NAV: { id: AppView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "library", label: "Library", icon: LayoutGrid },
  { id: "active_chats", label: "Active Chats", icon: MessageSquare },
  { id: "highlights_hub", label: "Highlights", icon: Highlighter },
  { id: "progress_hub", label: "Progress", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

export function GlobalShell({ children }: { children: ReactNode }) {
  const { view, setView, goLibrary, globalSearch, setGlobalSearch, userName } = useOpenRAG();

  const navigateNav = (id: AppView) => {
    if (id === "library") goLibrary();
    else setView(id);
  };

  const immersive = view === "reader" || view === "quiz";

  return (
    <div className="or-grain flex min-h-dvh w-full flex-col text-[var(--or-ink)]">
      {!immersive ? (
        <>
          <header className="sticky top-0 z-40 border-b border-[var(--or-border)] bg-[var(--or-bg)]/90 backdrop-blur-md">
            <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => goLibrary()}
                className="flex shrink-0 items-center gap-2 rounded-xl py-1 text-left transition-opacity hover:opacity-90"
                aria-label="OpenRAG home"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--or-ink)] text-[var(--or-cream)] shadow-or-card">
                  <BookOpen className="h-4 w-4" />
                </span>
                <span className="font-display hidden text-lg font-semibold tracking-tight sm:inline">OpenRAG</span>
              </button>

              <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--or-ink-muted)]" />
                <input
                  type="search"
                  placeholder="Search your library…"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="or-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm shadow-sm transition-shadow focus:shadow-md"
                />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                <ThemeModeControl compact />
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--or-border)] bg-[var(--or-cream)] font-mono text-sm font-bold text-[var(--or-ink)] shadow-sm"
                  title={userName}
                >
                  {userName.slice(0, 1)}
                </div>
              </div>
            </div>

            <nav
              className="flex w-full items-stretch gap-1 overflow-x-auto border-t border-[var(--or-border)]/80 bg-[var(--or-cream)]/60 px-4 py-2 dark:bg-[var(--or-cream)]/40 sm:px-6 lg:px-8 [-webkit-overflow-scrolling:touch]"
              aria-label="Main"
            >
              {NAV.map((item) => {
                const active = view === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateNav(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--or-ink)] text-[var(--or-cream)] shadow-sm"
                        : "text-[var(--or-ink-muted)] hover:bg-[var(--or-surface-muted)] hover:text-[var(--or-ink)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </header>
        </>
      ) : null}

      <motion.main
        layout
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
        initial={false}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.main>
    </div>
  );
}
