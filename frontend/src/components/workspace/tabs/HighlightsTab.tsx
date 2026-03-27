import { useCallback, useEffect, useState } from "react";
import { Highlighter, Trash2 } from "lucide-react";
import { humanApiError } from "@/api/client";
import { createHighlight, deleteHighlight, listHighlights } from "@/api/openrag";
import type { Highlight } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useWorkspace } from "@/context/WorkspaceContext";

export function HighlightsTab({ userId }: { userId: string }) {
  const { documentId } = useWorkspace();
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState("");
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listHighlights(userId, documentId);
      setItems(list);
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  }, [userId, documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!quote.trim()) return;
    setSaving(true);
    try {
      await createHighlight(userId, documentId, {
        quote_text: quote.trim(),
        page_start: pageStart ? parseInt(pageStart, 10) : undefined,
        page_end: pageEnd ? parseInt(pageEnd, 10) : undefined,
      });
      setQuote("");
      setPageStart("");
      setPageEnd("");
      await load();
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteHighlight(userId, id);
      setItems((xs) => xs.filter((h) => h.id !== id));
    } catch (e) {
      setError(humanApiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <Highlighter className="h-4 w-4 text-amber-600" />
          New highlight
        </h3>
        <Textarea
          className="mt-3"
          rows={3}
          placeholder="Paste or type a quote…"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <Input
            className="max-w-[100px]"
            placeholder="Page"
            value={pageStart}
            onChange={(e) => setPageStart(e.target.value)}
            inputMode="numeric"
          />
          <Input
            className="max-w-[100px]"
            placeholder="End"
            value={pageEnd}
            onChange={(e) => setPageEnd(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <Button className="mt-3" disabled={saving || !quote.trim()} onClick={() => void add()}>
          {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
          Save
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-zinc-400">No highlights yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((h) => (
            <li
              key={h.id}
              className="flex gap-3 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400">
                  {h.page_start != null ? `p.${h.page_start}` : "Page ?"}
                  {h.page_end != null && h.page_end !== h.page_start ? `–${h.page_end}` : ""}
                </p>
                <p className="mt-1 text-sm text-zinc-800">{h.quote_text}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete highlight"
                onClick={() => void remove(h.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
