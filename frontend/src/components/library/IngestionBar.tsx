import { ingestionLabel, ingestionProgressIndex, INGESTION_ORDER } from "@/lib/ingestion";

export function IngestionBar({ status }: { status: string }) {
  const failed = status === "failed";
  const idx = ingestionProgressIndex(status);
  const total = INGESTION_ORDER.length - 1;
  const pct = failed ? 0 : status === "ready" ? 100 : Math.min(100, Math.round((idx / total) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="font-medium text-zinc-700">{ingestionLabel(status)}</span>
        {!failed && status !== "ready" ? <span>{pct}%</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed ? "w-full bg-red-400" : "bg-indigo-500"
          }`}
          style={{ width: failed ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}
