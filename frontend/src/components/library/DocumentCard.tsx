import { FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { IngestionBar } from "@/components/library/IngestionBar";
import type { DocumentSummary } from "@/api/types";
import { ingestionLabel } from "@/lib/ingestion";

type Props = {
  doc: DocumentSummary;
  /** undefined = not fetched yet; null = no ingestion job */
  liveStatus?: string | null;
};

function statusTone(
  s: string,
): "neutral" | "success" | "warning" | "danger" | "indigo" {
  if (s === "ready") return "success";
  if (s === "failed") return "danger";
  if (s === "loading") return "neutral";
  if (["embedding", "indexing", "parsing", "chunking", "structure_extracting", "uploaded"].includes(s))
    return "indigo";
  return "neutral";
}

export function DocumentCard({ doc, liveStatus }: Props) {
  const status =
    liveStatus === undefined ? "loading" : liveStatus === null ? "uploaded" : liveStatus;
  const date = new Date(doc.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      to={`/doc/${doc.id}`}
      className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-card transition-all hover:border-indigo-200 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-zinc-900">{doc.title || "Untitled"}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {doc.page_count != null ? `${doc.page_count} pages · ` : ""}
              Updated {date}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(status)}>
          {status === "loading" ? "…" : ingestionLabel(status)}
        </Badge>
      </div>
      {liveStatus && liveStatus !== "ready" && liveStatus !== "failed" && liveStatus !== "loading" ? (
        <div className="mt-4">
          <IngestionBar status={liveStatus} />
        </div>
      ) : null}
    </Link>
  );
}
