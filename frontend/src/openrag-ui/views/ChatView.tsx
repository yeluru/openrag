import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, ListChecks, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatAsk, getChatMessages, getStructure, listChatSessions } from "@/api/openrag";
import type { ChatAskResponse, Citation, StructureNode } from "@/api/types";
import { humanApiError } from "@/api/client";
import { ModelAnswerMarkdown } from "@/components/ModelAnswerMarkdown";
import { useOpenRAG } from "../context/OpenRAGContext";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; citations?: Citation[] };

const STARTERS = [
  "Summarize this document",
  "What are the key deadlines or timelines?",
  "What should I study first?",
];

function flattenTopics(nodes: StructureNode[], max = 10): string[] {
  const out: string[] = [];
  const walk = (n: StructureNode) => {
    if (out.length >= max) return;
    const lab = (n.label || "").trim();
    if (lab.length > 1) out.push(lab);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out.slice(0, max);
}

function citationsFromStructured(sr: Record<string, unknown> | null | undefined): Citation[] | undefined {
  if (!sr || typeof sr !== "object") return undefined;
  const raw = (sr as { citations?: unknown }).citations;
  if (!Array.isArray(raw)) return undefined;
  return raw as Citation[];
}

export function ChatView() {
  const { userId, activeDocId, documents, goLibrary, openReader, openQuiz } = useOpenRAG();
  const doc = documents.find((d) => d.id === activeDocId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [topics, setTopics] = useState<string[]>([]);
  const [showStarters, setShowStarters] = useState(true);
  const [popover, setPopover] = useState<Citation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeDocId) return;
    let cancel = false;
    setBootLoading(true);
    void (async () => {
      try {
        const [tree, sessions] = await Promise.all([
          getStructure(userId, activeDocId),
          listChatSessions(userId, activeDocId),
        ]);
        if (cancel) return;
        setTopics(flattenTopics(tree.sections || []));
        const latest = sessions[0];
        if (latest) {
          setSessionId(latest.id);
          const hist = await getChatMessages(userId, latest.id);
          if (cancel) return;
          const mapped: Msg[] = [];
          for (const m of hist) {
            if (m.role === "user") mapped.push({ role: "user", text: m.content });
            else if (m.role === "assistant")
              mapped.push({
                role: "assistant",
                text: m.content,
                citations: citationsFromStructured(m.structured_response),
              });
          }
          setMessages(mapped);
          if (mapped.length) setShowStarters(false);
        } else {
          setSessionId(null);
          setMessages([]);
        }
      } catch {
        if (!cancel) setTopics([]);
      } finally {
        if (!cancel) setBootLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId, activeDocId]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !activeDocId || loading) return;
      setErr(null);
      setShowStarters(false);
      setMessages((m) => [...m, { role: "user", text }]);
      setLoading(true);
      try {
        const res: ChatAskResponse = await chatAsk(userId, {
          question: text,
          scope: { document_id: activeDocId },
          session_id: sessionId,
          top_k: 14,
        });
        setSessionId(res.session_id);
        setMessages((m) => [
          ...m,
          { role: "assistant", text: res.answer, citations: res.citations },
        ]);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (e) {
        setErr(humanApiError(e));
        setMessages((m) => m.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [userId, activeDocId, sessionId, loading],
  );

  const askAboutTopic = useCallback(
    (t: string) => {
      void send(`Explain how "${t}" fits into this book and what I should remember about it.`);
      textareaRef.current?.focus();
    },
    [send],
  );

  if (!activeDocId) {
    goLibrary();
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--or-bg)]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--or-border)] bg-[var(--or-cream)]/95 px-4 py-3 backdrop-blur-md sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={goLibrary}
          className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-sm font-medium text-[var(--or-ink-muted)] transition-colors hover:border-[var(--or-border)] hover:bg-[var(--or-bg)] hover:text-[var(--or-ink)] sm:px-3"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Library</span>
        </button>

        <div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-auto">
          <h1 className="truncate font-display text-base font-semibold tracking-tight text-[var(--or-ink)] sm:text-lg">
            {doc?.title || "Document"}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--or-ink-muted)]">
            {doc?.page_count != null ? `${doc.page_count} pages` : "Indexing…"} · Answers use retrieved passages from this PDF
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <button
            type="button"
            onClick={() => openReader(activeDocId)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--or-border)] bg-[var(--or-bg)] px-3 py-2 text-sm font-medium text-[var(--or-ink)] shadow-sm transition-colors hover:border-[var(--or-amber)]/35 hover:bg-[var(--or-cream)] sm:flex-initial"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-[var(--or-amber)]" />
            Reader
          </button>
          <button
            type="button"
            onClick={() => openQuiz(activeDocId)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--or-border)] bg-[var(--or-bg)] px-3 py-2 text-sm font-medium text-[var(--or-ink)] shadow-sm transition-colors hover:border-[var(--or-amber)]/35 hover:bg-[var(--or-cream)] sm:flex-initial"
          >
            <ListChecks className="h-4 w-4 shrink-0 text-[var(--or-amber)]" />
            Quiz
          </button>
        </div>
      </header>

      <div className="or-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[min(100%,1200px)] flex-1 px-4 py-6 sm:px-8 lg:px-10">
          {messages.length === 0 && !bootLoading ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--or-amber)]/15 text-[var(--or-amber)]">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[var(--or-ink)]">Ask about this book</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--or-ink-muted)]">
                Use the top navigation to jump elsewhere in OpenRAG. Starter prompts and outline topics below seed grounded questions.
              </p>
            </motion.div>
          ) : null}

          <div className="space-y-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[min(100%,42rem)] rounded-2xl rounded-br-md bg-[var(--or-ink)] px-5 py-3 text-[15px] leading-relaxed text-[var(--or-cream)] shadow-or-card">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--or-amber)] text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md border border-[var(--or-border)] bg-[var(--or-cream)] px-5 py-4 shadow-or-card lg:max-w-[min(100%,48rem)]">
                    <ModelAnswerMarkdown text={m.text} theme="openrag" />
                    {m.citations?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {m.citations.map((c, ci) => (
                          <button
                            key={`${c.chunk_id}-${ci}`}
                            type="button"
                            onClick={() => setPopover(c)}
                            className="rounded-full border border-[var(--or-amber)]/50 bg-[var(--or-amber)]/10 px-3 py-1.5 font-mono text-xs font-semibold text-[var(--or-ink)] hover:bg-[var(--or-amber)]/20"
                          >
                            Source{c.page_start != null ? ` · p.${c.page_start}` : ""}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {loading ? (
              <p className="text-sm text-[var(--or-ink-muted)]">Thinking with your sources…</p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {err ? <p className="shrink-0 px-4 py-2 text-center text-sm text-red-600 sm:px-8">{err}</p> : null}

      <div className="shrink-0 border-t border-[var(--or-border)] bg-[var(--or-cream)]/95 px-4 py-4 backdrop-blur-md sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-[min(100%,1200px)]">
          {topics.length > 0 && !bootLoading ? (
            <div className="mb-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--or-ink-muted)]">
                From the outline — tap to ask
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={loading}
                    onClick={() => askAboutTopic(t)}
                    className="shrink-0 max-w-[220px] truncate rounded-full border border-[var(--or-border)] bg-[var(--or-bg)] px-3 py-1.5 text-left text-xs font-medium text-[var(--or-ink)] transition-all hover:border-[var(--or-amber)]/45 hover:bg-[var(--or-accent-wash)] disabled:opacity-40"
                    title={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showStarters && messages.length === 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setInput("");
                    void send(s);
                  }}
                  className="rounded-full border border-[var(--or-border)] bg-[var(--or-bg)] px-4 py-2 text-xs font-medium text-[var(--or-ink)] transition-all hover:border-[var(--or-amber)]/50 hover:shadow-sm disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                  setInput("");
                }
              }}
              placeholder="Message OpenRAG…"
              className="or-input max-h-40 min-h-[52px] flex-1 resize-none rounded-2xl px-4 py-3 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void send(input);
                setInput("");
              }}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[var(--or-ink)] text-[var(--or-cream)] shadow-or-card transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {popover ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/20"
              aria-label="Close"
              onClick={() => setPopover(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-28 left-4 right-4 z-[101] mx-auto max-w-md rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-5 shadow-or-lift sm:left-auto sm:right-8 sm:mx-0"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--or-amber)]">
                Citation{popover.page_start != null ? ` · p.${popover.page_start}` : ""}
              </p>
              <blockquote className="mt-3 text-sm leading-relaxed text-[var(--or-ink)]">{popover.snippet}</blockquote>
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="mt-4 w-full rounded-xl bg-[var(--or-ink)] py-2.5 text-sm font-semibold text-[var(--or-cream)]"
              >
                Close
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
