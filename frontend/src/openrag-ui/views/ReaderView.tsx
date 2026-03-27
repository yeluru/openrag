import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Highlighter,
  Loader2,
  MessageSquare,
  Palette,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createHighlight,
  fetchDocumentPdfObjectUrl,
  getDocument,
  getDocumentReadthrough,
  listHighlights,
  notesAssist,
} from "@/api/openrag";
import type { Highlight, ReadthroughChunk } from "@/api/types";
import { humanApiError } from "@/api/client";
import { ModelAnswerMarkdown } from "@/components/ModelAnswerMarkdown";
import { ThemeModeControl } from "@/components/ThemeModeControl";
import { useOpenRAG } from "../context/OpenRAGContext";
import { aiSummaryKey, loadAiSummariesForDoc, notesKey } from "../lib/storage";
import type { ReaderTab } from "../types";

const OFFICE_READER_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function chunkTouchesPage(c: ReadthroughChunk, p: number): boolean {
  const a = c.page_start ?? c.page_end ?? 1;
  const b = c.page_end ?? c.page_start ?? a;
  return p >= a && p <= b;
}

/** Browsers cannot embed Word/Excel like PDF; reader shows indexed text instead. */
function isTextReaderDocument(mimeType: string, originalFilename: string): boolean {
  const m = (mimeType || "").toLowerCase();
  if (OFFICE_READER_MIMES.has(m)) return true;
  const f = (originalFilename || "").toLowerCase();
  return f.endsWith(".docx") || f.endsWith(".xlsx");
}

function formatPageOrSheetLabel(mimeType: string, pageCount: number | null): string | null {
  if (pageCount == null) return null;
  if ((mimeType || "").toLowerCase().includes("spreadsheetml.sheet")) {
    return `${pageCount} sheet${pageCount === 1 ? "" : "s"}`;
  }
  return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
}

export function ReaderView() {
  const { userId, activeDocId, documents, goLibrary, readerInitialTab, pushToast } = useOpenRAG();
  const summaryDoc = documents.find((d) => d.id === activeDocId);
  const [tab, setTab] = useState<ReaderTab>(readerInitialTab);
  const [panelOpen, setPanelOpen] = useState(true);
  const [page, setPage] = useState(1);
  /** Indexed-text page (chunk metadata); can differ from PDF `page` when browsing independently. */
  const [transcriptPage, setTranscriptPage] = useState(1);
  const [chunks, setChunks] = useState<ReadthroughChunk[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  /** Set with document fetch so PDF blob is not requested before we know the MIME type. */
  const [docMeta, setDocMeta] = useState<{ mimeType: string; originalFilename: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [summariesByPage, setSummariesByPage] = useState<Record<number, string>>({});
  const [summaryLoadingPages, setSummaryLoadingPages] = useState<Set<number>>(() => new Set());
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null);
  const [selText, setSelText] = useState("");

  const maxPage = Math.max(1, pageCount ?? 1);

  const textReaderMode = docMeta != null && isTextReaderDocument(docMeta.mimeType, docMeta.originalFilename);

  const chunksForViewerPage = useMemo(() => {
    return chunks
      .filter((c) => chunkTouchesPage(c, page))
      .sort((a, b) => (a.page_start ?? 0) - (b.page_start ?? 0));
  }, [chunks, page]);

  const pageOrSheetBadge = docMeta ? formatPageOrSheetLabel(docMeta.mimeType, pageCount) : null;

  /** PDF / notes / summary — keeps transcript page aligned when using footer or keyboard. */
  const advanceViewer = useCallback((delta: number) => {
    setPage((p) => {
      const n = Math.max(1, Math.min(maxPage, p + delta));
      setTranscriptPage(n);
      return n;
    });
  }, [maxPage]);

  function advanceTranscript(delta: number) {
    setTranscriptPage((tp) => Math.max(1, Math.min(maxPage, tp + delta)));
  }

  useEffect(() => {
    setTab(readerInitialTab);
  }, [readerInitialTab]);

  useEffect(() => {
    setToolbar(null);
    setSelText("");
  }, [tab]);

  useEffect(() => {
    if (!activeDocId) return;
    let cancel = false;
    setLoading(true);
    setErr(null);
    setDocMeta(null);
    void (async () => {
      try {
        const [doc, rt, hl] = await Promise.all([
          getDocument(userId, activeDocId),
          getDocumentReadthrough(userId, activeDocId),
          listHighlights(userId, activeDocId),
        ]);
        if (cancel) return;
        setTitle(doc.title);
        setPageCount(doc.page_count);
        setDocMeta({
          mimeType: doc.mime_type || "application/pdf",
          originalFilename: doc.original_filename || "",
        });
        setChunks(rt.chunks);
        setHighlights(hl);
        const maxP = doc.page_count ?? 1;
        setPage((p) => Math.min(Math.max(1, p), maxP));
        setTranscriptPage((tp) => Math.min(Math.max(1, tp), maxP));
      } catch (e) {
        if (!cancel) setErr(humanApiError(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId, activeDocId]);

  useEffect(() => {
    if (!activeDocId) {
      setSummariesByPage({});
      setSummaryLoadingPages(new Set());
      return;
    }
    setSummariesByPage(loadAiSummariesForDoc(activeDocId));
    setSummaryLoadingPages(new Set());
  }, [activeDocId]);

  useEffect(() => {
    if (!activeDocId || !docMeta) {
      setPdfObjectUrl(null);
      setPdfErr(null);
      return;
    }
    if (isTextReaderDocument(docMeta.mimeType, docMeta.originalFilename)) {
      setPdfObjectUrl(null);
      setPdfErr(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfErr(null);
    setPdfObjectUrl(null);
    void (async () => {
      try {
        const u = await fetchDocumentPdfObjectUrl(userId, activeDocId);
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        createdUrl = u;
        setPdfObjectUrl(u);
      } catch (e) {
        if (!cancelled) setPdfErr(humanApiError(e));
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [userId, activeDocId, docMeta]);

  useEffect(() => {
    if (!activeDocId) return;
    try {
      setNotes(localStorage.getItem(notesKey(activeDocId, page)) || "");
    } catch {
      setNotes("");
    }
  }, [activeDocId, page]);

  const persistNotes = (v: string) => {
    setNotes(v);
    if (activeDocId) {
      try {
        localStorage.setItem(notesKey(activeDocId, page), v);
      } catch {
        /* ignore */
      }
    }
  };

  const chunksForPage = chunks.filter((c) => chunkTouchesPage(c, transcriptPage));

  const summaryForPage = summariesByPage[page] ?? "";
  const summaryLoadingThisPage = summaryLoadingPages.has(page);

  const runSummary = async () => {
    if (!activeDocId) return;
    const targetPage = page;
    setSummaryLoadingPages((prev) => new Set(prev).add(targetPage));
    try {
      const lo = Math.max(1, targetPage - 1);
      const hi = Math.min(maxPage, targetPage + 1);
      const res = await notesAssist(userId, {
        scope: {
          document_id: activeDocId,
          page_start: lo,
          page_end: hi,
        },
        instruction: `Summarize the substantive content for page ${targetPage} of this PDF (primary focus). Neighboring pages ${lo}–${hi} are included only if they appear in the passages—prefer what belongs to page ${targetPage}.`,
        title: `Summary p.${targetPage}`,
        top_k: 16,
      });
      setSummariesByPage((prev) => ({ ...prev, [targetPage]: res.content }));
      try {
        localStorage.setItem(aiSummaryKey(activeDocId, targetPage), res.content);
      } catch {
        /* ignore */
      }
    } catch (e) {
      pushToast(humanApiError(e), "error");
    } finally {
      setSummaryLoadingPages((prev) => {
        const next = new Set(prev);
        next.delete(targetPage);
        return next;
      });
    }
  };

  const saveHighlight = async () => {
    if (!activeDocId || !selText.trim()) return;
    try {
      await createHighlight(userId, activeDocId, {
        page_start: transcriptPage,
        page_end: transcriptPage,
        quote_text: selText.slice(0, 20000),
      });
      pushToast("Highlight saved.");
      setHighlights(await listHighlights(userId, activeDocId));
      setToolbar(null);
      setSelText("");
    } catch (e) {
      pushToast(humanApiError(e), "error");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        advanceViewer(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        advanceViewer(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advanceViewer]);

  if (!activeDocId) {
    goLibrary();
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--or-bg)]">
      <div
        className="or-gradient-accent h-1.5 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]"
        aria-hidden
      />
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-[var(--or-amber)]/30 bg-gradient-to-b from-[var(--or-cream)] to-[var(--or-cream)]/90 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] backdrop-blur-md">
        <button
          type="button"
          onClick={goLibrary}
          className="flex items-center gap-2 rounded-xl border-2 border-[var(--or-amber)]/35 bg-[var(--or-bg)]/60 px-3 py-2 text-sm font-semibold text-[var(--or-ink)] shadow-sm transition-all hover:border-[var(--or-amber)]/70 hover:bg-[var(--or-cream)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Library
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">
              {title || summaryDoc?.title || "Document"}
            </h1>
            {pageOrSheetBadge ? (
              <span className="shrink-0 rounded-full bg-[var(--or-bg)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--or-ink-muted)] ring-1 ring-[var(--or-border)]">
                {pageOrSheetBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--or-ink-muted)]">
            {textReaderMode ? (
              <>
                Word/Excel preview shows <span className="text-[var(--or-ink)]/80">indexed text</span> per page or sheet ·
                same content as chat/RAG
              </>
            ) : (
              <>
                PDF viewer + notes follow the bottom bar · <span className="text-[var(--or-ink)]/80">Text</span> tab has its
                own page strip for indexed passages
              </>
            )}
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <ThemeModeControl compact />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="shrink-0 rounded-xl border border-[var(--or-border)] bg-[var(--or-cream)] px-3 py-2 text-sm font-medium text-[var(--or-ink)] shadow-sm transition-colors hover:bg-[var(--or-bg)]"
        >
          {panelOpen ? "Hide panel" : "Panel"}
        </button>
      </header>

      {err ? (
        <div className="shrink-0 border-b border-yellow-200/80 bg-yellow-50 px-4 py-2 text-center text-xs text-yellow-950">
          {err}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div
          className="relative flex min-w-0 flex-1 flex-col bg-[var(--or-bg)]"
          onClick={() => setToolbar(null)}
        >
          {textReaderMode ? (
            loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-[var(--or-ink-muted)]">
                <Loader2 className="h-10 w-10 animate-spin" />
                Loading content…
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-3 pb-2">
                <div className="relative min-h-0 flex-1 rounded-2xl border-[3px] border-slate-300/50 bg-gradient-to-b from-[var(--or-cream)] to-[var(--or-bg)] p-1 shadow-[inset_0_2px_12px_rgb(15_23_42_/_0.06)] dark:from-[var(--or-cream)]/90">
                  <div className="or-scrollbar h-full min-h-0 overflow-y-auto rounded-xl bg-[var(--or-cream)] p-4 ring-1 ring-[var(--or-border)]">
                    {chunksForViewerPage.length === 0 ? (
                      <p className="text-sm text-[var(--or-ink-muted)]">
                        No indexed text on this{" "}
                        {(docMeta?.mimeType || "").toLowerCase().includes("spreadsheetml.sheet") ? "sheet" : "page"} yet.
                        If ingestion just finished, refresh; otherwise open the Text tab to browse all chunks.
                      </p>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--or-ink)]">
                        {chunksForViewerPage.map((c) => c.text).join("\n\n—\n\n")}
                      </pre>
                    )}
                  </div>
                </div>
                <p className="mt-2 shrink-0 px-1 text-center text-[11px] leading-snug text-[var(--or-ink-muted)]">
                  .docx / .xlsx are shown as extracted text (not a live Office preview). The original file is still stored for
                  download from your machine if you keep a copy.
                </p>
              </div>
            )
          ) : pdfErr ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-red-600">{pdfErr}</p>
              <p className="max-w-md text-xs text-[var(--or-ink-muted)]">
                The original file could not be loaded. You can still open the Transcript tab for indexed plain text after
                ingestion finishes.
              </p>
            </div>
          ) : !pdfObjectUrl ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-[var(--or-ink-muted)]">
              <Loader2 className="h-10 w-10 animate-spin" />
              {docMeta ? "Loading PDF…" : "Loading document…"}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-3 pb-2">
              <div className="relative min-h-0 flex-1 rounded-2xl border-[3px] border-slate-300/50 bg-gradient-to-b from-slate-200/60 to-slate-300/40 p-2 shadow-[inset_0_2px_12px_rgb(15_23_42_/_0.1)]">
                <div className="or-inset-well relative h-full min-h-0 overflow-hidden rounded-xl ring-2 ring-white shadow-md">
                  <iframe
                    key={page}
                    title={title || "PDF"}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                    src={`${pdfObjectUrl}#page=${page}`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="shrink-0 px-3 pb-3 pt-1">
            <div className="flex items-center justify-between rounded-xl border-2 border-[var(--or-amber)]/25 bg-[var(--or-cream)] px-2 py-2 font-mono text-[11px] text-[var(--or-ink-muted)] shadow-or-card sm:px-4 sm:text-xs">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-lg px-2 py-1.5 font-sans text-sm font-medium text-[var(--or-ink)] transition-colors hover:bg-[var(--or-surface-muted)] disabled:opacity-30 sm:px-3"
                onClick={() => advanceViewer(-1)}
              >
                ← Prev
              </button>
              <span className="px-1 text-center leading-tight">
                <span className="hidden text-[var(--or-ink-muted)] sm:inline">
                  {textReaderMode ? "Preview & notes · " : "PDF & notes · "}
                </span>
                {(docMeta?.mimeType || "").toLowerCase().includes("spreadsheetml.sheet") ? "Sheet" : "Page"} {page} /{" "}
                {maxPage}
              </span>
              <button
                type="button"
                disabled={page >= maxPage}
                className="rounded-lg px-2 py-1.5 font-sans text-sm font-medium text-[var(--or-ink)] transition-colors hover:bg-[var(--or-surface-muted)] disabled:opacity-30 sm:px-3"
                onClick={() => advanceViewer(1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {panelOpen ? (
            <>
              <button
                type="button"
                aria-label="Close side panel"
                className="fixed inset-0 z-[55] bg-[var(--or-ink)]/20 backdrop-blur-[1px] md:hidden"
                onClick={() => setPanelOpen(false)}
              />
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[60] flex min-w-0 max-w-[min(100vw,380px)] shrink-0 flex-col border border-[var(--or-border)] border-l-4 border-l-[var(--or-amber)] bg-gradient-to-b from-[var(--or-accent-wash)] via-[var(--or-cream)] to-[var(--or-bg)] shadow-or-lift md:static md:z-0 md:max-w-none md:shadow-none"
              >
              <div className="border-b border-[var(--or-border)] bg-[var(--or-bg)]/80 p-2">
                <p className="mb-2 px-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--or-ink-muted)]">
                  Tools
                </p>
                <div className="flex gap-0.5 rounded-[13px] bg-[var(--or-surface-muted)] p-1 ring-1 ring-[var(--or-border)]">
                  {(
                    [
                      { id: "highlights" as const, label: "Marks", tip: "Highlights" as const, Icon: Highlighter },
                      { id: "notes" as const, label: "Notes", tip: "Notes" as const, Icon: StickyNote },
                      { id: "summary" as const, label: "AI", tip: "AI summary" as const, Icon: Sparkles },
                      { id: "transcript" as const, label: "Text", tip: "Indexed transcript" as const, Icon: FileText },
                    ] as const
                  ).map(({ id, label, tip, Icon }) => {
                    const active = tab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        title={tip}
                        className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[10px] py-2 transition-all ${
                          active
                            ? "bg-[var(--or-cream)] text-[var(--or-ink)] shadow-sm ring-1 ring-[var(--or-border)]"
                            : "text-[var(--or-ink-muted)] hover:bg-black/[0.03] hover:text-[var(--or-ink)]"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${active ? "text-[var(--or-amber)]" : ""}`} />
                        <span className="max-w-full truncate px-0.5 text-[8px] font-bold uppercase leading-none tracking-wide sm:text-[9px]">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="or-scrollbar max-h-[calc(100dvh-8rem)] overflow-y-auto p-4">
                {tab === "highlights" ? (
                  highlights.length === 0 ? (
                    <p className="text-sm text-[var(--or-ink-muted)]">
                      No highlights yet. Open the <span className="font-semibold text-[var(--or-ink)]">Text</span> tab,
                      move to the right transcript page with its Prev/Next, select text, then save a highlight.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {highlights.map((h) => (
                        <li key={h.id} className="rounded-[12px] border border-[var(--or-border)] bg-[var(--or-bg)] p-3 text-sm shadow-sm">
                          <span className="font-mono text-[10px] text-[var(--or-ink-muted)]">
                            p.{h.page_start ?? "?"}
                          </span>
                          <p className="mt-1 leading-relaxed text-[var(--or-ink)]">{h.quote_text || "—"}</p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
                {tab === "notes" ? (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--or-ink-muted)]">Notes · page {page}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => persistNotes(e.target.value)}
                      rows={12}
                      placeholder="Your notes (saved in this browser)…"
                      className="or-input mt-2 w-full resize-none rounded-[12px] p-3 text-sm"
                    />
                  </div>
                ) : null}
                {tab === "summary" ? (
                  <div className="space-y-3">
                    {summaryForPage ? (
                      <div className="rounded-[12px] border border-[var(--or-sage)]/40 bg-[var(--or-sage)]/10 p-4">
                        <ModelAnswerMarkdown text={summaryForPage} theme="openrag" />
                      </div>
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-[var(--or-border)] bg-[var(--or-bg)] p-6 text-center">
                        <p className="text-sm text-[var(--or-ink-muted)]">
                          No AI summary for <span className="font-mono text-[var(--or-ink)]">page {page}</span> yet.
                        </p>
                        <p className="mt-2 text-xs text-[var(--or-ink-muted)]">Generate one below—it is saved for this page only.</p>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={summaryLoadingThisPage}
                      onClick={() => void runSummary()}
                      className="w-full rounded-[12px] bg-[var(--or-ink)] py-2.5 text-sm font-semibold text-[var(--or-cream)] disabled:opacity-50"
                    >
                      {summaryLoadingThisPage
                        ? "Generating…"
                        : summaryForPage
                          ? "Regenerate AI summary (this page)"
                          : "Generate AI summary (this page)"}
                    </button>
                  </div>
                ) : null}
                {tab === "transcript" ? (
                  <div
                    className="relative"
                    onMouseUp={(ev) => {
                      const t = window.getSelection()?.toString().trim();
                      if (t && t.length > 2) {
                        setSelText(t);
                        setToolbar({ x: ev.clientX, y: ev.clientY });
                      }
                    }}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--or-border)] bg-[var(--or-surface-muted)]/60 p-1.5 ring-1 ring-[var(--or-border)]">
                      <div className="flex items-center gap-0.5 rounded-lg bg-[var(--or-cream)] p-0.5 shadow-sm ring-1 ring-[var(--or-border)]">
                        <button
                          type="button"
                          disabled={transcriptPage <= 1}
                          className="rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--or-ink)] transition-colors hover:bg-[var(--or-surface-muted)] disabled:opacity-30"
                          onClick={() => advanceTranscript(-1)}
                        >
                          ←
                        </button>
                        <span className="min-w-[4.5rem] px-1 text-center font-mono text-[10px] font-medium text-[var(--or-ink)]">
                          {transcriptPage} / {maxPage}
                        </span>
                        <button
                          type="button"
                          disabled={transcriptPage >= maxPage}
                          className="rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--or-ink)] transition-colors hover:bg-[var(--or-surface-muted)] disabled:opacity-30"
                          onClick={() => advanceTranscript(1)}
                        >
                          →
                        </button>
                      </div>
                      {transcriptPage !== page ? (
                        <button
                          type="button"
                          className="rounded-lg border border-[var(--or-amber)]/35 bg-[var(--or-amber)]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--or-ink)] transition-colors hover:bg-[var(--or-amber)]/18"
                          onClick={() => setTranscriptPage(page)}
                        >
                          Sync → {textReaderMode ? "preview" : "PDF"} p.{page}
                        </button>
                      ) : null}
                    </div>
                    {transcriptPage !== page ? (
                      <p className="mb-2 text-[11px] leading-relaxed text-[var(--or-amber)]">
                        {textReaderMode ? (
                          <>
                            Main preview is on page {page}; you are browsing indexed text for page {transcriptPage}.
                          </>
                        ) : (
                          <>
                            PDF viewer is on page {page}; you are browsing indexed text for page {transcriptPage}.
                          </>
                        )}
                      </p>
                    ) : null}
                    <p className="mb-3 text-xs leading-relaxed text-[var(--or-ink-muted)]">
                      {textReaderMode ? (
                        <>
                          Indexed plain text (chunked for RAG)—layout differs from the original Office file. Use Prev/Next
                          here to change passage pages; use the bar below the preview to move the main reader.
                        </>
                      ) : (
                        <>
                          Indexed plain text (chunked for RAG)—layout differs from the PDF. Use Prev/Next here to change
                          passage pages; use the bar below the PDF for the viewer.
                        </>
                      )}
                    </p>
                    {loading ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-[var(--or-ink-muted)]">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-xs">Loading transcript…</span>
                      </div>
                    ) : chunks.length === 0 ? (
                      <p className="text-sm text-[var(--or-ink-muted)]">
                        No indexed text yet. Wait for ingestion to finish, then refresh.
                      </p>
                    ) : chunksForPage.length === 0 ? (
                      <p className="text-sm text-[var(--or-ink-muted)]">
                        No transcript for text page {transcriptPage}. Try Text Prev/Next or{" "}
                        <button type="button" className="underline" onClick={() => setTranscriptPage(page)}>
                          jump to {textReaderMode ? "preview" : "PDF"} page {page}
                        </button>
                        .
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {chunksForPage.map((c) => (
                          <div key={c.chunk_id} className="border-b border-[var(--or-border)]/50 pb-4 last:border-0">
                            {(c.chapter_label || c.section_label) && (
                              <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-[var(--or-amber)]">
                                {[c.chapter_label, c.section_label].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            <div className="text-sm leading-relaxed text-[var(--or-ink)] whitespace-pre-wrap">{c.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <AnimatePresence>
                      {toolbar && tab === "transcript" ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="fixed z-[80] flex gap-1 rounded-xl border border-[var(--or-border)] bg-[var(--or-cream)] p-1.5 shadow-or-lift"
                          style={{
                            left: Math.max(
                              12,
                              Math.min(toolbar.x - 80, (typeof window !== "undefined" ? window.innerWidth : 400) - 180),
                            ),
                            top: Math.max(12, toolbar.y - 48),
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="rounded-lg p-2 hover:bg-[var(--or-amber)]/15"
                            title="Save highlight"
                            onClick={() => void saveHighlight()}
                          >
                            <Palette className="h-4 w-4 text-[var(--or-amber)]" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 hover:bg-black/[0.04]"
                            title="Note"
                            onClick={() => pushToast("Use the Notes tab for this page.", "info")}
                          >
                            <StickyNote className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 hover:bg-black/[0.04]"
                            title="Ask in chat"
                            onClick={() => pushToast("Open Chat from the library card to ask about this doc.", "info")}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}
              </div>
            </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      </div>

      <footer className="shrink-0 border-t border-[var(--or-border)] bg-[var(--or-cream)] px-4 py-2 text-center font-mono text-[10px] text-[var(--or-ink-muted)]">
        <kbd className="rounded bg-[var(--or-bg)] px-1.5 py-0.5">←</kbd> /{" "}
        <kbd className="rounded bg-[var(--or-bg)] px-1.5 py-0.5">→</kbd> move PDF &amp; notes (and sync Text to the same page). Text tab has its own Prev/Next.
      </footer>
    </div>
  );
}
