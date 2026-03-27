import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Citation, Scope, SearchResult, SourcePassage, StructureNode } from "@/api/types";

export type PanelPayload =
  | { kind: "citation"; data: Citation }
  | { kind: "passage"; data: SourcePassage }
  | { kind: "search"; data: SearchResult }
  | { kind: "readthrough"; data: { sectionId: string; title: string } };

type Ctx = {
  documentId: string;
  scope: Scope;
  selectedSectionId: string | null;
  selectSection: (sectionId: string | null) => void;
  structure: StructureNode[];
  setStructure: (s: StructureNode[]) => void;
  ingestionReady: boolean;
  setIngestionReady: (v: boolean) => void;
  panel: PanelPayload | null;
  openPanel: (p: PanelPayload) => void;
  closePanel: () => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({
  documentId,
  children,
}: {
  documentId: string;
  children: ReactNode;
}) {
  const [structure, setStructure] = useState<StructureNode[]>([]);
  const [ingestionReady, setIngestionReady] = useState(false);
  const [panel, setPanel] = useState<PanelPayload | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [scope, setScopeState] = useState<Scope>(() => ({
    document_id: documentId,
  }));

  const selectSection = useCallback(
    (sectionId: string | null) => {
      setSelectedSectionId(sectionId);
      if (!sectionId) setScopeState({ document_id: documentId });
      else setScopeState({ document_id: documentId, section_id: sectionId });
    },
    [documentId],
  );

  const openPanel = useCallback((p: PanelPayload) => setPanel(p), []);
  const closePanel = useCallback(() => setPanel(null), []);

  const value = useMemo(
    () => ({
      documentId,
      scope,
      selectedSectionId,
      selectSection,
      structure,
      setStructure,
      ingestionReady,
      setIngestionReady,
      panel,
      openPanel,
      closePanel,
    }),
    [
      documentId,
      scope,
      selectedSectionId,
      selectSection,
      structure,
      ingestionReady,
      panel,
      openPanel,
      closePanel,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("useWorkspace outside provider");
  return c;
}
