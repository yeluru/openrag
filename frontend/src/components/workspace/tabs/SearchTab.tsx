import { useState } from "react";
import { MessageSquareText, Search } from "lucide-react";
import { humanApiError } from "@/api/client";
import { semanticSearch } from "@/api/openrag";
import type { SearchResult } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useWorkspace } from "@/context/WorkspaceContext";

export function SearchTab({
  userId,
  onGoToAsk,
}: {
  userId: string;
  onGoToAsk: (prefill: string) => void;
}) {
  const { scope, openPanel } = useWorkspace();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const query = q.trim();
    if (!query) return;
    setError(null);
    setLoading(true);
    try {
      const res = await semanticSearch(userId, { query, scope, top_k: 12, min_score: 0 });
      setResults(res.results);
    } catch (e) {
      setError(humanApiError(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-semibold text-zinc-900">Find in book</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Locates indexed passages (same scope as your focus chip). Open a hit for full text, or send it to Ask.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Keywords, phrase, or topic…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          className="rounded-2xl border-zinc-200"
        />
        <Button
          disabled={loading || !q.trim()}
          onClick={() => void run()}
          className="h-11 shrink-0 rounded-2xl px-5"
        >
          {loading ? <Spinner className="h-4 w-4 text-white" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <ul className="space-y-3">
        {results.map((r) => (
          <li
            key={r.chunk_id}
            className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-shadow hover:shadow-soft"
          >
            <button
              type="button"
              className="w-full px-4 py-3 text-left"
              onClick={() => openPanel({ kind: "search", data: r })}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                {r.chapter_label || "Document"}
                {r.page_start != null ? ` · p.${r.page_start}` : ""}
              </p>
              <p className="mt-2 line-clamp-5 text-[15px] leading-relaxed text-zinc-800">{r.text}</p>
            </button>
            <div className="border-t border-zinc-50 px-3 py-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                onClick={() =>
                  onGoToAsk(`Explain this passage in the context of the book:\n\n${r.text.slice(0, 900)}`)
                }
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Ask about this
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!loading && results.length === 0 && q && !error ? (
        <p className="text-center text-sm text-zinc-400">No matches in this focus. Try whole book or other words.</p>
      ) : null}
    </div>
  );
}
