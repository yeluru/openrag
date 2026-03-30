import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { humanApiError } from "@/api/client";
import { getIngestion, getSupportedDocumentFormats, listDocuments, uploadDocument } from "@/api/openrag";
import type { DocumentSummary, SupportedFormatsResponse } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { DocumentCard } from "@/components/library/DocumentCard";
import { UploadZone } from "@/components/library/UploadZone";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserId } from "@/hooks/useUserId";
import { isNonTerminalIngestionStatus } from "@/lib/ingestion";

export function LibraryPage() {
  const [userId] = useUserId();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusByDoc, setStatusByDoc] = useState<Record<string, string | null | undefined>>({});
  const [ingestionRefreshing, setIngestionRefreshing] = useState(false);
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await listDocuments(userId);
      setDocs(list);
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Merge latest ingestion status from API (server runs chunking/embeddings). */
  const mergeIngestionStatuses = useCallback(async () => {
    if (docs.length === 0) return;
    const next: Record<string, string | null> = {};
    await Promise.all(
      docs.map(async (d) => {
        try {
          const ing = await getIngestion(userId, d.id);
          next[d.id] = ing.status;
        } catch {
          next[d.id] = null;
        }
      }),
    );
    setStatusByDoc((prev) => ({ ...prev, ...next }));
  }, [docs, userId]);

  const refreshIngestionStatuses = useCallback(async () => {
    setIngestionRefreshing(true);
    try {
      await mergeIngestionStatuses();
    } finally {
      setIngestionRefreshing(false);
    }
  }, [mergeIngestionStatuses]);

  useEffect(() => {
    if (docs.length === 0) return;
    void mergeIngestionStatuses();
  }, [docs, userId, mergeIngestionStatuses]);

  /** Light auto-poll while any doc is not ready/failed so the Library updates without only manual clicks. */
  useEffect(() => {
    if (docs.length === 0) return;
    const anyActive = docs.some((d) => isNonTerminalIngestionStatus(statusByDoc[d.id]));
    if (!anyActive) return;
    const t = setInterval(() => void mergeIngestionStatuses(), 12_000);
    return () => clearInterval(t);
  }, [docs, statusByDoc, mergeIngestionStatuses]);

  const onUpload = async (file: File) => {
    setError(null);
    try {
      const res = await uploadDocument(userId, file);
      setStatusByDoc((prev) => ({ ...prev, [res.document_id]: res.status }));
      await refresh();
    } catch (e) {
      setError(humanApiError(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Library</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Upload documents the server can ingest, then open one to chat, search, quiz, and take
          notes—always grounded in your sources.
        </p>
      </div>

      {error ? (
        <div className="mb-8">
          <Alert variant="error" title="Could not complete request">
            {error}
            <button
              type="button"
              className="mt-2 text-sm font-medium text-red-800 underline"
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </Alert>
        </div>
      ) : null}

      <UploadZone onFile={onUpload} supportedFormats={supportedFormats} />

      <div className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Your documents</h2>
          {!loading && docs.length > 0 ? (
            <button
              type="button"
              disabled={ingestionRefreshing}
              onClick={() => void refreshIngestionStatuses()}
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
            >
              {ingestionRefreshing ? "Checking…" : "Refresh indexing status"}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Parsing, chunking, and embeddings run on the server. Status refreshes about every 12s while a document
          is still indexing; use the button for an immediate check.
        </p>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : docs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-8 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-800">No documents yet</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Drop a PDF above to get started. We&apos;ll parse, chunk, and index it so you can learn
              with confidence.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {docs.map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} liveStatus={statusByDoc[d.id]} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
