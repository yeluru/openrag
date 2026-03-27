import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Heart,
  Highlighter,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupportedDocumentFormats } from "@/api/openrag";
import type { DocumentSummary, SupportedFormatsResponse } from "@/api/types";
import {
  buildFileInputAccept,
  formatExtensionsHint,
  isFileAllowedForIngest,
} from "@/lib/documentFormats";
import { useOpenRAG, engagementPercent } from "../context/OpenRAGContext";
import { ProgressRing } from "../components/ProgressRing";
import type { LibraryFilter } from "../types";

function hashHue(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h % 360;
}

function DocCard({ doc }: { doc: DocumentSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });

  const hue = hashHue(doc.title);
  const {
    openReader,
    openChat,
    openQuiz,
    toggleFavorite,
    toggleCompleted,
    favorites,
    completed,
    engagementByDoc,
    pendingIngestDocIds,
  } = useOpenRAG();
  const [hover, setHover] = useState(false);

  const indexing = pendingIngestDocIds.has(doc.id) || doc.page_count == null;
  const eventCount = engagementByDoc[doc.id]?.event_count ?? 0;
  const pct = engagementPercent(eventCount);
  const activityHint =
    "How much you’ve used this book (chat, search, quiz, highlights, etc.)—not upload speed or indexing. " +
    "The % is a log scale, so it rises quickly at first then slows near 100%.";

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
    setHover(false);
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      className="or-card group relative overflow-hidden rounded-[12px] bg-[var(--or-cream)] p-0 shadow-or-card transition-shadow duration-300 hover:shadow-or-lift"
    >
      <div
        className="relative h-36 overflow-hidden"
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 42% 42%) 0%, hsl(${(hue + 40) % 360} 38% 28%) 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={() => toggleFavorite(doc.id)}
            className="rounded-full bg-black/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
            aria-label="Favorite"
          >
            <Heart className={`h-4 w-4 ${favorites.has(doc.id) ? "fill-[var(--or-amber)] text-[var(--or-amber)]" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => toggleCompleted(doc.id)}
            className="rounded-full bg-black/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
            title="Mark completed"
            aria-label="Completed"
          >
            <CheckCircle2 className={`h-4 w-4 ${completed.has(doc.id) ? "text-[var(--or-amber)]" : ""}`} />
          </button>
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-display text-lg font-semibold leading-snug text-white drop-shadow-sm line-clamp-2">
            {doc.title || "Untitled"}
          </h3>
        </div>
      </div>
      <div className="relative p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--or-border)] bg-[var(--or-bg)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--or-ink-muted)]">
            {indexing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Indexing…
              </>
            ) : (
              <>{doc.page_count ?? "—"} pp.</>
            )}
          </span>
          {indexing ? (
            <div
              className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-dashed border-[var(--or-amber)]/40 bg-[var(--or-amber)]/5"
              title="PDF is still being parsed and embedded. This is not a percent-complete bar—wait until “Indexing…” clears."
            >
              <Loader2 className="h-5 w-5 animate-spin text-[var(--or-amber)]" />
            </div>
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              <ProgressRing
                percent={pct}
                size={48}
                stroke={3}
                title={activityHint}
              />
              <span className="max-w-[4.5rem] text-right font-mono text-[9px] leading-tight text-[var(--or-ink-muted)]">
                Activity
                <br />
                {eventCount}×
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--or-ink-muted)]">
          Added{" "}
          {new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
        <div
          className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 transition-all duration-300 ${
            hover ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90 sm:translate-y-0 sm:opacity-100"
          }`}
        >
          <IconAction
            label="Chat"
            disabled={indexing}
            onClick={() => openChat(doc.id)}
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <IconAction
            label="Read"
            disabled={indexing}
            onClick={() => openReader(doc.id)}
            icon={<BookOpen className="h-4 w-4" />}
          />
          <IconAction
            label="Quiz"
            disabled={indexing}
            onClick={() => openQuiz(doc.id)}
            icon={<Target className="h-4 w-4" />}
          />
          <IconAction
            label="Marks"
            disabled={indexing}
            onClick={() => openReader(doc.id, "highlights")}
            icon={<Highlighter className="h-4 w-4" />}
          />
        </div>
      </div>
    </motion.div>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--or-border)] bg-[var(--or-bg)] py-2 text-[var(--or-ink-muted)] shadow-sm transition-all hover:border-[var(--or-amber)]/45 hover:bg-[var(--or-amber)]/12 hover:text-[var(--or-ink)] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
    >
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-wide">{label}</span>
    </button>
  );
}

export function LibraryView() {
  const {
    userName,
    documents,
    libraryFilter,
    setLibraryFilter,
    globalSearch,
    uploadBusy,
    uploadPdf,
    pushToast,
    libraryLoading,
    libraryError,
    engagementByDoc,
    refreshLibrary,
    favorites,
    completed,
  } = useOpenRAG();

  const query = globalSearch.trim().toLowerCase();

  const filteredResolved = useMemo(() => {
    let list = [...documents];
    if (query) list = list.filter((d) => (d.title || "").toLowerCase().includes(query));
    if (libraryFilter === "favorites") list = list.filter((d) => favorites.has(d.id));
    if (libraryFilter === "completed") list = list.filter((d) => completed.has(d.id));
    if (libraryFilter === "recent") {
      list.sort((a, b) => {
        const ta = engagementByDoc[a.id]?.last_activity_at ?? a.created_at;
        const tb = engagementByDoc[b.id]?.last_activity_at ?? b.created_at;
        return new Date(tb).getTime() - new Date(ta).getTime();
      });
    }
    return list;
  }, [documents, query, libraryFilter, engagementByDoc, favorites, completed]);

  const filters: { id: LibraryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "recent", label: "Recently Opened" },
    { id: "completed", label: "Completed" },
    { id: "favorites", label: "Favorites" },
  ];

  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSupportedDocumentFormats()
      .then((f) => {
        if (!cancelled) setSupportedFormats(f);
      })
      .catch(() => {
        if (!cancelled) setSupportedFormats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tryUploadFile = (f: File) => {
    if (supportedFormats && !isFileAllowedForIngest(f, supportedFormats)) {
      pushToast(
        `This file type isn’t supported. Use: ${formatExtensionsHint(supportedFormats, 8)}.`,
        "info",
      );
      return;
    }
    void uploadPdf(f);
  };

  const fileAccept = supportedFormats ? buildFileInputAccept(supportedFormats) : undefined;
  const formatsSubtitle = supportedFormats
    ? `Supported types: ${formatExtensionsHint(supportedFormats)}`
    : "Loading supported types from the server…";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 xl:px-12">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <motion.p
              className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              What will you learn today,{" "}
              <span className="text-[var(--or-amber)]">{userName}</span>?
            </motion.p>
            <p className="mt-2 max-w-xl text-sm text-[var(--or-ink-muted)]">
              Upload a document — OpenRAG indexes it and grounds every answer in your sources.
            </p>
          </div>
          <motion.div
            className="hidden items-center gap-2 rounded-full border border-[var(--or-sage)]/40 bg-[var(--or-sage)]/15 px-4 py-2 text-sm text-[var(--or-ink)] md:flex"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4 text-[var(--or-amber)]" />
            Connected to your library
          </motion.div>
        </div>
      </motion.section>

      {libraryError ? (
        <div className="mb-6 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {libraryError}{" "}
          <button type="button" className="ml-2 font-semibold underline" onClick={() => void refreshLibrary()}>
            Retry
          </button>
        </div>
      ) : null}

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) tryUploadFile(f);
        }}
        animate={
          dragOver
            ? { scale: 1.01, boxShadow: "0 0 0 3px var(--or-amber), 0 12px 40px hsl(250 95% 64% / 0.18)" }
            : { scale: 1, boxShadow: "var(--or-shadow-card)" }
        }
        transition={{ duration: 0.35 }}
        className="or-card relative mb-10 cursor-pointer rounded-2xl border-[3px] border-dashed border-[var(--or-amber)]/45 bg-gradient-to-br from-[var(--or-cream)] via-[var(--or-accent-wash)] to-[var(--or-bg)] p-8 text-center shadow-or-card transition-colors hover:border-[var(--or-amber)] hover:shadow-or-lift"
        onClick={() => !uploadBusy && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !uploadBusy && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={fileAccept}
          className="hidden"
          disabled={uploadBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) tryUploadFile(f);
            e.target.value = "";
          }}
        />
        <motion.div
          animate={dragOver ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 1.2, repeat: dragOver ? Infinity : 0 }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--or-ink)] text-[var(--or-cream)]"
        >
          {uploadBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        </motion.div>
        <p className="font-display text-lg font-semibold text-[var(--or-ink)]">
          {dragOver ? "Drop to start learning" : "Drag & drop a document"}
        </p>
        <p className="mt-1 text-sm text-[var(--or-ink-muted)]">or click to browse — {formatsSubtitle}</p>
      </motion.div>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setLibraryFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              libraryFilter === f.id
                ? "bg-[var(--or-ink)] text-[var(--or-cream)] shadow-or-card ring-1 ring-black/5"
                : "bg-[var(--or-cream)] text-[var(--or-ink-muted)] ring-1 ring-[var(--or-border)] hover:bg-[var(--or-bg)] hover:ring-[var(--or-amber)]/35"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {libraryLoading ? (
          <motion.div
            key="sk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)]">
                <div className="h-36 animate-pulse bg-zinc-200" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
                  <div className="h-14 animate-pulse rounded-xl bg-zinc-100" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : filteredResolved.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--or-border)] bg-[var(--or-cream)]/60 py-20 text-center"
          >
            <LayoutGrid className="mb-4 h-12 w-12 text-[var(--or-sage)]" />
            <p className="font-display text-xl font-semibold">No documents match</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--or-ink-muted)]">Upload a document or change filters.</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            style={{ perspective: 1200 }}
          >
            {filteredResolved.map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
