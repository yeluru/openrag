import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  bootstrapUser,
  getIngestion,
  listDocumentEngagement,
  listDocuments,
  uploadDocument,
} from "@/api/openrag";
import { humanApiError } from "@/api/client";
import type { DocumentEngagement, DocumentSummary } from "@/api/types";
import { completedStorage, favoriteStorage } from "../lib/storage";
import type { AppView, DocumentId, LibraryFilter, ReaderTab } from "../types";

export type ToastMessage = {
  id: string;
  message: string;
  tone?: "success" | "info" | "error";
};

/** Maps learning-activity event count → 0–100 for library ring (log curve; not upload %). */
function engagementPercent(count: number): number {
  if (count <= 0) return 0;
  return Math.min(100, Math.round(10 + Math.log2(1 + count) * 18));
}

interface OpenRAGContextValue {
  userId: string;
  userName: string;
  documents: DocumentSummary[];
  engagementByDoc: Record<string, DocumentEngagement>;
  libraryLoading: boolean;
  libraryError: string | null;
  uploadBusy: boolean;
  pendingIngestDocIds: Set<string>;
  favorites: Set<string>;
  completed: Set<string>;
  view: AppView;
  activeDocId: DocumentId | null;
  readerInitialTab: ReaderTab;
  libraryFilter: LibraryFilter;
  globalSearch: string;
  refreshLibrary: () => Promise<void>;
  setView: (v: AppView) => void;
  setActiveDocId: (id: DocumentId | null) => void;
  openReader: (docId: DocumentId, tab?: ReaderTab) => void;
  openChat: (docId: DocumentId) => void;
  openQuiz: (docId: DocumentId) => void;
  goLibrary: () => void;
  setLibraryFilter: (f: LibraryFilter) => void;
  setGlobalSearch: (s: string) => void;
  toggleFavorite: (docId: DocumentId) => void;
  toggleCompleted: (docId: DocumentId) => void;
  uploadPdf: (file: File) => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (message: string, tone?: ToastMessage["tone"]) => void;
  dismissToast: (id: string) => void;
}

const OpenRAGContext = createContext<OpenRAGContextValue | null>(null);

let toastSeq = 0;

export function OpenRAGProvider({
  userId,
  children,
  initialDisplayName,
}: {
  userId: string;
  children: ReactNode;
  /** From sign-in; server bootstrap may still refine display name. */
  initialDisplayName?: string | null;
}) {
  const [userName, setUserName] = useState(() => initialDisplayName?.trim() || "there");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [engagementByDoc, setEngagementByDoc] = useState<Record<string, DocumentEngagement>>({});
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingIngestDocIds, setPendingIngestDocIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(() => favoriteStorage.load());
  const [completed, setCompleted] = useState<Set<string>>(() => completedStorage.load());

  const [view, setView] = useState<AppView>("library");
  const [activeDocId, setActiveDocId] = useState<DocumentId | null>(null);
  const [readerInitialTab, setReaderInitialTab] = useState<ReaderTab>("highlights");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [globalSearch, setGlobalSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((message: string, tone: ToastMessage["tone"] = "success") => {
    const id = `t-${++toastSeq}`;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const [docs, eng] = await Promise.all([listDocuments(userId), listDocumentEngagement(userId)]);
      setDocuments(docs);
      const map: Record<string, DocumentEngagement> = {};
      for (const row of eng) map[row.document_id] = row;
      setEngagementByDoc(map);
    } catch (e) {
      setLibraryError(humanApiError(e));
    } finally {
      setLibraryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialDisplayName?.trim()) setUserName(initialDisplayName.trim());
  }, [initialDisplayName]);

  useEffect(() => {
    void bootstrapUser(userId)
      .then((u) => {
        if (u.display_name?.trim()) setUserName(u.display_name.trim());
      })
      .catch(() => null);
  }, [userId]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  const goLibrary = useCallback(() => {
    setView("library");
    setActiveDocId(null);
  }, []);

  const openReader = useCallback((docId: DocumentId, tab: ReaderTab = "highlights") => {
    setReaderInitialTab(tab);
    setActiveDocId(docId);
    setView("reader");
  }, []);

  const openChat = useCallback((docId: DocumentId) => {
    setActiveDocId(docId);
    setView("chat");
  }, []);

  const openQuiz = useCallback((docId: DocumentId) => {
    setActiveDocId(docId);
    setView("quiz");
  }, []);

  const toggleFavorite = useCallback((docId: DocumentId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      favoriteStorage.save(next);
      return next;
    });
  }, []);

  const toggleCompleted = useCallback((docId: DocumentId) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      completedStorage.save(next);
      return next;
    });
  }, []);

  /** Server does all indexing; we only peek once—Library has “Refresh indexing status” for updates. */
  const pollIngestion = useCallback(
    async (docId: string) => {
      setPendingIngestDocIds((s) => new Set(s).add(docId));
      await new Promise((r) => setTimeout(r, 1200));
      try {
        const ing = await getIngestion(userId, docId);
        if (ing.status === "ready") pushToast("Document ready to read.");
        else if (ing.status === "failed") pushToast(ing.error_message || "Ingestion failed.", "error");
        else
          pushToast(
            "Indexing runs on the server. Open Library and click Refresh indexing status to see progress.",
          );
      } catch {
        /* job row may lag briefly after upload */
      }
      setPendingIngestDocIds((s) => {
        const n = new Set(s);
        n.delete(docId);
        return n;
      });
      await refreshLibrary();
    },
    [userId, pushToast, refreshLibrary],
  );

  const uploadPdf = useCallback(
    async (file: File) => {
      setUploadBusy(true);
      try {
        const res = await uploadDocument(userId, file);
        pushToast("Upload started — indexing in background.");
        void pollIngestion(res.document_id);
        await refreshLibrary();
      } catch (e) {
        pushToast(humanApiError(e), "error");
      } finally {
        setUploadBusy(false);
      }
    },
    [userId, pushToast, pollIngestion, refreshLibrary],
  );

  const value = useMemo(
    () => ({
      userId,
      userName,
      documents,
      engagementByDoc,
      libraryLoading,
      libraryError,
      uploadBusy,
      pendingIngestDocIds,
      favorites,
      completed,
      view,
      activeDocId,
      readerInitialTab,
      libraryFilter,
      globalSearch,
      refreshLibrary,
      setView,
      setActiveDocId,
      openReader,
      openChat,
      openQuiz,
      goLibrary,
      setLibraryFilter,
      setGlobalSearch,
      toggleFavorite,
      toggleCompleted,
      uploadPdf,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      userId,
      userName,
      documents,
      engagementByDoc,
      libraryLoading,
      libraryError,
      uploadBusy,
      pendingIngestDocIds,
      favorites,
      completed,
      view,
      activeDocId,
      readerInitialTab,
      libraryFilter,
      globalSearch,
      refreshLibrary,
      openReader,
      openChat,
      openQuiz,
      goLibrary,
      toggleFavorite,
      toggleCompleted,
      uploadPdf,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <OpenRAGContext.Provider value={value}>{children}</OpenRAGContext.Provider>;
}

export function useOpenRAG() {
  const c = useContext(OpenRAGContext);
  if (!c) throw new Error("useOpenRAG outside OpenRAGProvider");
  return c;
}

export { engagementPercent };
