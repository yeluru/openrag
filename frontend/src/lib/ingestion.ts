/** Maps backend IngestionStatus to user-facing labels and order for progress UI */

export const INGESTION_ORDER = [
  "uploaded",
  "parsing",
  "structure_extracting",
  "chunking",
  "embedding",
  "indexing",
  "ready",
] as const;

export type IngestionStatus = (typeof INGESTION_ORDER)[number] | "failed";

const LABELS: Record<string, string> = {
  uploaded: "Queued",
  parsing: "Parsing PDF",
  structure_extracting: "Structure",
  chunking: "Chunking",
  embedding: "Embedding",
  indexing: "Indexing",
  ready: "Ready",
  failed: "Failed",
};

export function ingestionLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, " ");
}

export function ingestionProgressIndex(status: string): number {
  if (status === "failed") return -1;
  const i = INGESTION_ORDER.indexOf(status as (typeof INGESTION_ORDER)[number]);
  return i >= 0 ? i : 0;
}
