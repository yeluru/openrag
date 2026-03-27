import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useOpenRAG } from "../context/OpenRAGContext";

export function ToastHost() {
  const { toasts, dismissToast } = useOpenRAG();

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-or-card ${
              t.tone === "error"
                ? "border-red-200 bg-red-50"
                : t.tone === "info"
                  ? "border-[var(--or-sage)]/40 bg-[var(--or-cream)]"
                  : "border-[var(--or-amber)]/35 bg-[var(--or-cream)]"
            }`}
          >
            <p className="flex-1 text-sm font-medium text-[var(--or-ink)]">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded-lg p-1 text-[var(--or-ink-muted)] hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
