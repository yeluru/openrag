import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { humanApiError } from "@/api/client";
import { chatAsk } from "@/api/openrag";
import type { ChatAskResponse, Citation } from "@/api/types";
import { AnswerProse } from "@/components/workspace/AnswerProse";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Input";
import { useWorkspace } from "@/context/WorkspaceContext";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; payload: ChatAskResponse };

const SUGGESTIONS = [
  "What is the author trying to teach, in one paragraph?",
  "What are the hardest ideas here, and how does the text define them?",
  "How would you explain the core argument to a colleague?",
  "What should I re-read carefully before moving on?",
];

type Props = {
  userId: string;
  prefill?: string | null;
  onConsumePrefill?: () => void;
};

export function ChatTab({ userId, prefill, onConsumePrefill }: Props) {
  const { scope, openPanel } = useWorkspace();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefill?.trim()) return;
    setInput(prefill);
    onConsumePrefill?.();
  }, [prefill, onConsumePrefill]);

  const sendMessage = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      setError(null);
      setMessages((m) => [...m, { role: "user", text: q }]);
      setLoading(true);
      try {
        const res = await chatAsk(userId, {
          question: q,
          scope,
          mode: "beginner_explanation",
          session_id: sessionId,
          top_k: 14,
        });
        setSessionId(res.session_id);
        setMessages((m) => [...m, { role: "assistant", payload: res }]);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (e) {
        setError(humanApiError(e));
        setMessages((m) => m.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [loading, userId, scope, sessionId],
  );

  const weakEvidence = (r: ChatAskResponse) =>
    r.retrieval_meta?.insufficient_evidence ||
    /could not find any passages|retrieval confidence was low|evidence in the retrieved passages is limited/i.test(
      r.answer,
    );

  return (
    <div className="flex h-full min-h-[min(520px,70dvh)] flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto px-0.5 py-2">
        {messages.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white p-8 shadow-card">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-100/90 to-violet-100/50 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-indigo-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-sans text-lg font-semibold tracking-tight text-zinc-900">Ask anything</h2>
                  <p className="text-sm text-zinc-500">Answers stay tied to this book and your current focus.</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-zinc-600">
                Use the <span className="font-medium text-zinc-800">book map</span> to limit a chapter or part, or stay
                on the whole book. Open the <span className="font-medium text-zinc-800">read</span> icon beside any
                heading to see stitched text from the index.
              </p>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-widest text-zinc-400">Try</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setInput("");
                      void sendMessage(s);
                    }}
                    className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-left text-sm leading-snug text-zinc-800 transition-all hover:border-indigo-200 hover:bg-white hover:shadow-soft disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl rounded-br-md bg-zinc-900 px-5 py-3.5 text-[15px] leading-relaxed text-white shadow-lg shadow-zinc-900/10">
                {m.text}
              </div>
            </div>
          ) : (
            <AssistantBubble
              key={i}
              payload={m.payload}
              weak={weakEvidence(m.payload)}
              onCitation={(c) => openPanel({ kind: "citation", data: c })}
            />
          ),
        )}
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
            <Spinner className="h-5 w-5 text-indigo-500" />
            <span>Pulling the best passages…</span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}
      <div className="mt-auto flex gap-3 border-t border-zinc-200/80 pt-5">
        <Textarea
          rows={2}
          placeholder="Ask in your own words…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
              setInput("");
            }
          }}
          className="min-h-[60px] flex-1 resize-none rounded-2xl border-zinc-200 bg-white text-[15px] shadow-sm"
        />
        <Button
          className="h-[60px] w-[60px] shrink-0 self-end rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/25 hover:bg-indigo-700"
          disabled={loading || !input.trim()}
          onClick={() => {
            void sendMessage(input);
            setInput("");
          }}
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function AssistantBubble({
  payload,
  weak,
  onCitation,
}: {
  payload: ChatAskResponse;
  weak: boolean;
  onCitation: (c: Citation) => void;
}) {
  return (
    <div className="max-w-[min(100%,42rem)] space-y-5 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-card md:p-8">
      {weak ? (
        <Alert variant="warning" title="Softer match to the text">
          Citations may be thin for this question—check the sources below or widen focus to the whole book.
        </Alert>
      ) : null}
      <AnswerProse text={payload.answer} />
      {payload.citations?.length ? (
        <div className="border-t border-zinc-100 pt-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sources</p>
          <div className="flex flex-wrap gap-2">
            {payload.citations.map((c, ci) => (
              <button
                key={`${c.chunk_id}-${ci}`}
                type="button"
                onClick={() => onCitation(c)}
                className="max-w-full truncate rounded-full border border-indigo-100 bg-indigo-50/90 px-4 py-2 text-left text-xs font-medium text-indigo-950 transition-colors hover:border-indigo-200 hover:bg-indigo-100/80"
              >
                {c.chapter_label || "Passage"}
                {c.page_start != null ? ` · p.${c.page_start}` : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
