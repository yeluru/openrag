import { ChevronRight, Globe, MapPin } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { findSectionLabel } from "@/lib/structureTree";

type Props = {
  onRequestChangeScope?: () => void;
};

/** Compact scope indicator: what part of the book tools are using. */
export function ScopeChip({ onRequestChangeScope }: Props) {
  const { structure, selectedSectionId } = useWorkspace();
  const label = findSectionLabel(structure, selectedSectionId);
  const narrow = Boolean(selectedSectionId);

  return (
    <button
      type="button"
      onClick={onRequestChangeScope}
      className="group flex max-w-full items-center gap-2 rounded-full border border-zinc-200/90 bg-white py-1.5 pl-2.5 pr-3 text-left shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          narrow ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-600"
        }`}
      >
        {narrow ? <MapPin className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Focus
        </span>
        <span className="block truncate text-[13px] font-medium text-zinc-900">
          {narrow ? label || "Selected part" : "Whole book"}
        </span>
      </span>
      {onRequestChangeScope ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-indigo-400" />
      ) : null}
    </button>
  );
}
