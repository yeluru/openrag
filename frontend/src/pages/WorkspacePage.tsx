import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  FileText,
  Highlighter,
  Layers,
  Library,
  MessageSquare,
  Search,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { humanApiError } from "@/api/client";
import { getDocument, getIngestion, getStructure } from "@/api/openrag";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ContextPanel } from "@/components/workspace/ContextPanel";
import { ScopeChip } from "@/components/workspace/ScopeChip";
import { StructureSidebar } from "@/components/workspace/StructureSidebar";
import { ChatTab } from "@/components/workspace/tabs/ChatTab";
import { FlashcardsTab } from "@/components/workspace/tabs/FlashcardsTab";
import { HighlightsTab } from "@/components/workspace/tabs/HighlightsTab";
import { NotesTab } from "@/components/workspace/tabs/NotesTab";
import { QuizTab } from "@/components/workspace/tabs/QuizTab";
import { SearchTab } from "@/components/workspace/tabs/SearchTab";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { useUserId } from "@/hooks/useUserId";
import { ingestionLabel } from "@/lib/ingestion";

const PRIMARY_TOOLS = [
  { id: "ask" as const, label: "Ask", icon: MessageSquare, blurb: "Grounded Q&A" },
  { id: "find" as const, label: "Find", icon: Search, blurb: "Search passages" },
];

const STUDY_TOOLS = [
  { id: "quiz" as const, label: "Quiz", icon: Brain },
  { id: "cards" as const, label: "Cards", icon: Layers },
  { id: "notes" as const, label: "Notes", icon: FileText },
  { id: "highlights" as const, label: "Highlights", icon: Highlighter },
];

type ToolId = (typeof PRIMARY_TOOLS)[number]["id"] | (typeof STUDY_TOOLS)[number]["id"];

export function WorkspacePage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [userId] = useUserId();
  if (!documentId) return null;
  return (
    <WorkspaceProvider key={documentId} documentId={documentId}>
      <WorkspaceInner userId={userId} />
    </WorkspaceProvider>
  );
}

function WorkspaceInner({ userId }: { userId: string }) {
  const { documentId, setStructure, setIngestionReady, panel } = useWorkspace();
  const [tool, setTool] = useState<ToolId>("ask");
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studySheet, setStudySheet] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function boot() {
      setLoadErr(null);
      try {
        const doc = await getDocument(userId, documentId);
        if (cancel) return;
        setTitle(doc.title);
        const st = doc.ingestion?.status ?? null;
        setIngestStatus(st);
        if (st === "ready") {
          setIngestionReady(true);
          const tree = await getStructure(userId, documentId);
          if (!cancel) setStructure(tree.sections);
        } else {
          setIngestionReady(false);
          setStructure([]);
        }
      } catch (e) {
        if (!cancel) setLoadErr(humanApiError(e));
      }
    }
    void boot();
    return () => {
      cancel = true;
    };
  }, [userId, documentId, setStructure, setIngestionReady]);

  useEffect(() => {
    if (ingestStatus === "ready" || ingestStatus === "failed") return;
    const t = setInterval(async () => {
      try {
        const ing = await getIngestion(userId, documentId);
        setIngestStatus(ing.status);
        if (ing.status === "ready") {
          setIngestionReady(true);
          const tree = await getStructure(userId, documentId);
          setStructure(tree.sections);
        }
      } catch {
        /* 404 etc */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [userId, documentId, ingestStatus, setStructure, setIngestionReady]);

  const clearChatPrefill = useCallback(() => setChatPrefill(null), []);

  const goToAsk = (prefill: string) => {
    setTool("ask");
    setChatPrefill(prefill);
    setStudySheet(false);
  };

  const toolContent = () => {
    switch (tool) {
      case "ask":
        return (
          <ChatTab userId={userId} prefill={chatPrefill} onConsumePrefill={clearChatPrefill} />
        );
      case "find":
        return <SearchTab userId={userId} onGoToAsk={goToAsk} />;
      case "quiz":
        return <QuizTab userId={userId} />;
      case "cards":
        return <FlashcardsTab userId={userId} />;
      case "notes":
        return <NotesTab userId={userId} />;
      case "highlights":
        return <HighlightsTab userId={userId} />;
      default:
        return null;
    }
  };

  const studyActive = tool === "quiz" || tool === "cards" || tool === "notes" || tool === "highlights";

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f4f6] lg:flex-row">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/35 backdrop-blur-[2px] lg:hidden"
          aria-label="Close book map"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(100%,320px)] border-r border-zinc-200/80 bg-white shadow-2xl transition-transform lg:static lg:z-0 lg:w-[300px] lg:shrink-0 lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <StructureSidebar onCloseMobile={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/90 px-3 py-3 backdrop-blur-md sm:px-5">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <Button variant="ghost" className="mt-0.5 shrink-0 px-2 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Layers className="h-5 w-5 text-indigo-600" />
              </Button>
              <Link
                to="/"
                className="mt-0.5 inline-flex shrink-0 rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                title="Library"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-sans text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
                    {title || <span className="inline-block h-5 w-40 animate-pulse rounded-md bg-zinc-200" />}
                  </h1>
                  {ingestStatus ? (
                    <Badge
                      tone={
                        ingestStatus === "ready"
                          ? "success"
                          : ingestStatus === "failed"
                            ? "danger"
                            : "indigo"
                      }
                    >
                      {ingestionLabel(ingestStatus)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block">
                  <BookOpen className="mr-1 inline h-3 w-3 align-text-bottom" />
                  One place to read, search, and ask—always scoped by your focus chip.
                </p>
              </div>
            </div>
            <ScopeChip onRequestChangeScope={() => setSidebarOpen(true)} />
          </div>

          <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {PRIMARY_TOOLS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTool(id);
                    setStudySheet(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    tool === id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                      : "bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200/80 hover:ring-indigo-200"
                  }`}
                >
                  <Icon className="h-4 w-4 opacity-90" />
                  {label}
                </button>
              ))}
              <span className="hidden h-6 w-px bg-zinc-200 sm:block" aria-hidden />
              <span className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-400 sm:mr-1 sm:w-auto">
                Study
              </span>
              {STUDY_TOOLS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTool(id);
                    setStudySheet(false);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    tool === id
                      ? "bg-violet-100 text-violet-900 ring-2 ring-violet-300/60"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 opacity-80" />
                    {label}
                  </span>
                </button>
              ))}
            </div>
            {(tool === "ask" || tool === "find") && (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {tool === "ask"
                  ? PRIMARY_TOOLS[0].blurb + " — answers cite indexed passages."
                  : PRIMARY_TOOLS[1].blurb + " — respects your focus."}
              </p>
            )}
            {studyActive ? (
              <p className="text-[11px] text-zinc-500">Study tools use the same focus as Ask and Find.</p>
            ) : null}
          </div>
        </header>

        {loadErr ? (
          <div className="p-6 text-center text-sm text-red-600">{loadErr}</div>
        ) : ingestStatus && ingestStatus !== "ready" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <Spinner className="h-10 w-10 text-indigo-500" />
            <p className="max-w-sm text-sm text-zinc-600">
              {ingestionLabel(ingestStatus)} — the workspace unlocks when indexing finishes.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:max-w-4xl lg:px-10 lg:py-10">{toolContent()}</div>
            </div>
            {panel ? <ContextPanel /> : null}
          </div>
        )}
      </div>

      {/* Mobile: quick access */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-zinc-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold text-zinc-500"
        >
          <Library className="h-5 w-5 text-indigo-600" />
          Map
        </button>
        <button
          type="button"
          onClick={() => {
            setTool("ask");
            setStudySheet(false);
          }}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
            tool === "ask" ? "text-indigo-600" : "text-zinc-500"
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          Ask
        </button>
        <button
          type="button"
          onClick={() => {
            setTool("find");
            setStudySheet(false);
          }}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
            tool === "find" ? "text-indigo-600" : "text-zinc-500"
          }`}
        >
          <Search className="h-5 w-5" />
          Find
        </button>
        <button
          type="button"
          onClick={() => setStudySheet(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
            studyActive ? "text-violet-700" : "text-zinc-500"
          }`}
        >
          <Brain className="h-5 w-5" />
          Study
        </button>
      </nav>
      <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden" aria-hidden />

      {studySheet ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-zinc-900/40 lg:hidden"
            aria-label="Close study menu"
            onClick={() => setStudySheet(false)}
          />
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-2 right-2 z-50 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl lg:hidden">
            <p className="border-b border-zinc-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Study
            </p>
            <div className="grid grid-cols-2 gap-2 p-3">
              {STUDY_TOOLS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTool(id);
                    setStudySheet(false);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left text-sm font-medium text-zinc-800"
                >
                  <Icon className="h-4 w-4 text-violet-600" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
