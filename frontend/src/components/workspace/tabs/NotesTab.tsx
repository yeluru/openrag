import { useState } from "react";
import { FileText } from "lucide-react";
import { humanApiError } from "@/api/client";
import { notesAssist } from "@/api/openrag";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useWorkspace } from "@/context/WorkspaceContext";

export function NotesTab({ userId }: { userId: string }) {
  const { scope } = useWorkspace();
  const [instruction, setInstruction] = useState(
    "Summarize the main ideas in clear bullet points with short headings.",
  );
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string | null>(null);

  const run = async () => {
    const ins = instruction.trim();
    if (!ins) return;
    setError(null);
    setLoading(true);
    try {
      const res = await notesAssist(userId, {
        scope,
        instruction: ins,
        title: title.trim() || null,
        top_k: 12,
      });
      setContent(res.content);
      setNoteTitle(res.title);
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (content) void navigator.clipboard.writeText(content);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Title (optional)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Study notes" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">What should we write?</label>
        <Textarea rows={4} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      </div>
      <Button disabled={loading || !instruction.trim()} onClick={() => void run()}>
        {loading ? <Spinner className="h-4 w-4 text-white" /> : <FileText className="h-4 w-4" />}
        Generate notes
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {content ? (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-900">{noteTitle || "Notes"}</h3>
            <Button variant="secondary" className="shrink-0 text-xs" onClick={copy}>
              Copy
            </Button>
          </div>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{content}</div>
        </div>
      ) : null}
    </div>
  );
}
