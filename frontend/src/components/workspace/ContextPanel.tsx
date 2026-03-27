import { useEffect, useState } from "react";
import { BookMarked, BookOpen, X } from "lucide-react";
import { humanApiError } from "@/api/client";
import { getSectionReadthrough } from "@/api/openrag";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useUserId } from "@/hooks/useUserId";
import { Spinner } from "@/components/ui/Spinner";

export function ContextPanel() {
  const { panel, closePanel } = useWorkspace();
  if (!panel) return null;

  const title =
    panel.kind === "readthrough"
      ? "Read"
      : panel.kind === "citation"
        ? "Source"
        : panel.kind === "passage"
          ? "Passage"
          : "Search hit";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-zinc-900/25 backdrop-blur-[2px] lg:hidden"
        aria-label="Close panel"
        onClick={closePanel}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-zinc-200/80 bg-white shadow-2xl lg:static lg:z-0 lg:max-w-md lg:shrink-0 lg:shadow-none">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            {panel.kind === "readthrough" ? (
              <BookOpen className="h-4 w-4 text-indigo-600" />
            ) : (
              <BookMarked className="h-4 w-4 text-indigo-600" />
            )}
            {title}
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {panel.kind === "readthrough" ? (
            <ReadthroughBody sectionId={panel.data.sectionId} heading={panel.data.title} />
          ) : panel.kind === "citation" ? (
            <div className="p-4">
              <CitationBody c={panel.data} />
            </div>
          ) : panel.kind === "passage" ? (
            <div className="p-4">
              <PassageBody p={panel.data} />
            </div>
          ) : (
            <div className="p-4">
              <SearchBody r={panel.data} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ReadthroughBody({ sectionId, heading }: { sectionId: string; heading: string }) {
  const [userId] = useUserId();
  const { documentId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [chunks, setChunks] = useState<
    { chunk_id: string; text: string; page_start: number | null; chapter_label: string | null; section_label: string | null }[]
  >([]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const res = await getSectionReadthrough(userId, documentId, sectionId);
        if (!cancel) setChunks(res.chunks);
      } catch (e) {
        if (!cancel) setErr(humanApiError(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId, documentId, sectionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-zinc-500">
        <Spinner className="h-8 w-8" />
        Loading indexed text…
      </div>
    );
  }
  if (err) {
    return <p className="p-4 text-sm text-red-600">{err}</p>;
  }
  if (chunks.length === 0) {
    return (
      <p className="p-4 text-sm leading-relaxed text-zinc-500">
        No indexed passages for this part yet. Try a child chapter in the map, or re-run ingestion if the outline
        changed.
      </p>
    );
  }

  return (
    <article className="readthrough-article px-5 py-4 pb-12">
      <header className="mb-6 border-b border-zinc-100 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Indexed read-through</p>
        <h3 className="mt-1 font-serif text-xl font-semibold tracking-tight text-zinc-900">{heading}</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Plain text from ingestion chunks (for RAG)—not the original PDF layout. Open <strong>Read</strong> in the library
          to view the real document; use Ask here with citations.
        </p>
      </header>
      <div className="space-y-8">
        {chunks.map((c, i) => (
          <section key={c.chunk_id} className="relative">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-400">
              {c.chapter_label ? <span className="text-zinc-600">{c.chapter_label}</span> : null}
              {c.section_label ? <span>{c.section_label}</span> : null}
              {c.page_start != null ? (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600">p.{c.page_start}</span>
              ) : null}
              <span className="text-zinc-300">·</span>
              <span>Passage {i + 1}</span>
            </div>
            <div className="font-serif text-[16px] leading-[1.8] text-zinc-800 whitespace-pre-wrap">{c.text}</div>
          </section>
        ))}
      </div>
    </article>
  );
}

function metaLine(
  pageStart: number | null | undefined,
  pageEnd: number | null | undefined,
  chapter: string | null | undefined,
  section: string | null | undefined,
) {
  const parts: string[] = [];
  if (chapter) parts.push(chapter);
  if (section) parts.push(section);
  if (pageStart != null) {
    parts.push(
      pageEnd != null && pageEnd !== pageStart ? `pp. ${pageStart}–${pageEnd}` : `p. ${pageStart}`,
    );
  }
  return parts.join(" · ") || "Document";
}

function CitationBody({ c }: { c: import("@/api/types").Citation }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Citation</p>
      <p className="text-xs text-zinc-500">{metaLine(c.page_start, c.page_end, c.chapter_label, c.section_label)}</p>
      <blockquote className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-[15px] leading-relaxed text-zinc-800">
        {c.snippet}
      </blockquote>
      <p className="font-mono text-[10px] text-zinc-400">chunk {c.chunk_id}</p>
    </div>
  );
}

function PassageBody({ p }: { p: import("@/api/types").SourcePassage }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Passage</p>
      <p className="text-xs text-zinc-500">{metaLine(p.page_start, p.page_end, p.chapter_label, p.section_label)}</p>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">
        {p.text}
      </div>
    </div>
  );
}

function SearchBody({ r }: { r: import("@/api/types").SearchResult }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Search hit</p>
      <p className="text-xs text-zinc-500">{metaLine(r.page_start, r.page_end, r.chapter_label, r.section_label)}</p>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">
        {r.text}
      </div>
    </div>
  );
}
