import { BookOpen, ChevronDown, ChevronRight, Library } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { StructureNode } from "@/api/types";

function kindLabel(kind: string): string | null {
  if (kind === "chapter") return "Chapter";
  if (kind === "section") return "Section";
  if (kind === "logical") return "Part";
  return null;
}

function NodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  onRead,
}: {
  node: StructureNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRead: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children?.length > 0;
  const selected = selectedId === node.id;
  const k = kindLabel(node.kind);

  return (
    <div>
      <div
        className="flex items-center gap-0.5 rounded-xl transition-colors hover:bg-zinc-50/80"
        style={{ paddingLeft: depth * 10 }}
      >
        {hasKids ? (
          <button
            type="button"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-[13px] transition-all ${
            selected
              ? "bg-indigo-600 font-medium text-white shadow-sm shadow-indigo-500/25"
              : "text-zinc-800 hover:bg-zinc-100/80"
          }`}
        >
          <span className="flex items-center gap-2">
            {k ? (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  selected ? "bg-white/20 text-white" : "bg-zinc-200/80 text-zinc-600"
                }`}
              >
                {k}
              </span>
            ) : null}
            <span className="truncate">{node.label || "Section"}</span>
          </span>
          {node.page_start != null ? (
            <span
              className={`mt-0.5 block truncate text-[11px] ${selected ? "text-indigo-100" : "text-zinc-400"}`}
            >
              p.{node.page_start}
              {node.page_end != null && node.page_end !== node.page_start ? `–${node.page_end}` : ""}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          title="Read stitched text from the index for this part"
          onClick={(e) => {
            e.stopPropagation();
            onRead(node.id, node.label || "Section");
          }}
          className={`shrink-0 rounded-lg p-2 transition-colors ${
            selected
              ? "text-indigo-100 hover:bg-white/10 hover:text-white"
              : "text-zinc-400 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
        </button>
      </div>
      {hasKids && open
        ? node.children.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onRead={onRead}
            />
          ))
        : null}
    </div>
  );
}

export function StructureSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { structure, selectSection, selectedSectionId, openPanel } = useWorkspace();

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-zinc-50/50">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
          <Library className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Book map</h2>
          <p className="text-[11px] leading-snug text-zinc-500">
            Tap a row to <span className="font-medium text-zinc-700">focus</span> Ask &amp; Find. Use{" "}
            <BookOpen className="inline h-3 w-3 align-text-bottom text-indigo-600" /> to read indexed text
            for that part.
          </p>
        </div>
        {onCloseMobile ? (
          <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs lg:hidden" onClick={onCloseMobile}>
            Done
          </Button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Button
          variant={selectedSectionId ? "secondary" : "primary"}
          className="mb-3 w-full justify-center rounded-xl py-2.5 text-xs font-semibold shadow-sm"
          onClick={() => {
            selectSection(null);
            onCloseMobile?.();
          }}
        >
          Use whole book
        </Button>
        {structure.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-xs leading-relaxed text-zinc-400">
            The outline fills in after indexing. Then you can focus on a chapter or open stitched text.
          </p>
        ) : (
          structure.map((n) => (
            <NodeRow
              key={n.id}
              node={n}
              depth={0}
              selectedId={selectedSectionId}
              onSelect={(id) => {
                selectSection(id);
                onCloseMobile?.();
              }}
              onRead={(id, title) => {
                openPanel({ kind: "readthrough", data: { sectionId: id, title } });
                onCloseMobile?.();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
