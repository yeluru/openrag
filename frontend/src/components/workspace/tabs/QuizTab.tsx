import { useState } from "react";
import { Brain, CheckCircle2 } from "lucide-react";
import { humanApiError } from "@/api/client";
import { generateQuiz, submitQuizAttempt } from "@/api/openrag";
import type { QuizQuestion } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useWorkspace } from "@/context/WorkspaceContext";

export function QuizTab({ userId }: { userId: string }) {
  const { scope } = useWorkspace();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [scoreResult, setScoreResult] = useState<{ score: number; fraction: number } | null>(null);

  const generate = async () => {
    setError(null);
    setLoading(true);
    setScoreResult(null);
    try {
      const res = await generateQuiz(userId, {
        scope,
        topic: topic.trim() || null,
        num_questions: 5,
        difficulty: "intermediate",
      });
      setQuizId(res.quiz_id);
      setTitle(res.title);
      setQuestions(res.questions);
      setIdx(0);
      setAnswers({});
      setRevealed({});
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!quizId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await submitQuizAttempt(userId, quizId, answers);
      setScoreResult({ score: res.score, fraction: res.score_fraction });
    } catch (e) {
      setError(humanApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const q = questions[idx];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-zinc-500">Topic (optional)</label>
          <Input
            className="mt-1"
            placeholder="e.g. key definitions in chapter 2"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <Button disabled={loading} onClick={() => void generate()}>
          {loading ? <Spinner className="h-4 w-4 text-white" /> : <Brain className="h-4 w-4" />}
          Generate quiz
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {scoreResult ? (
        <Alert variant="info" title="Quiz submitted">
          Score: <strong>{scoreResult.score}%</strong> ({Math.round(scoreResult.fraction * 100)}% correct on
          auto-graded items)
        </Alert>
      ) : null}
      {questions.length > 0 && q ? (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-900">{title}</h3>
            <span className="text-xs text-zinc-400">
              {idx + 1} / {questions.length}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-800">{q.question_text}</p>
          <QuestionInput
            q={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            revealed={!!revealed[q.id]}
            onReveal={() => setRevealed((r) => ({ ...r, [q.id]: true }))}
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              Back
            </Button>
            <Button variant="secondary" disabled={idx >= questions.length - 1} onClick={() => setIdx((i) => i + 1)}>
              Next
            </Button>
            <Button className="ml-auto" disabled={loading} onClick={() => void submit()}>
              <CheckCircle2 className="h-4 w-4" />
              Submit all
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionInput({
  q,
  value,
  onChange,
  revealed,
  onReveal,
}: {
  q: QuizQuestion;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onReveal: () => void;
}) {
  const opts = Array.isArray(q.options)
    ? q.options
    : q.options && typeof q.options === "object"
      ? Object.values(q.options as Record<string, unknown>).map(String)
      : null;

  if (q.question_type === "multiple_choice" && opts?.length) {
    return (
      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          {opts.map((o) => (
            <button
              key={String(o)}
              type="button"
              onClick={() => onChange(String(o))}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                value === String(o)
                  ? "border-indigo-500 bg-indigo-50 text-indigo-950"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              {String(o)}
            </button>
          ))}
        </div>
        {revealed ? <Explanation q={q} /> : <Reveal onReveal={onReveal} />}
      </div>
    );
  }

  if (q.question_type === "true_false") {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          {["true", "false"].map((o) => (
            <Button
              key={o}
              variant={value === o ? "primary" : "secondary"}
              className="flex-1 capitalize"
              onClick={() => onChange(o)}
            >
              {o}
            </Button>
          ))}
        </div>
        {revealed ? <Explanation q={q} /> : <Reveal onReveal={onReveal} />}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <Input placeholder="Your answer" value={value} onChange={(e) => onChange(e.target.value)} />
      {revealed ? <Explanation q={q} /> : <Reveal onReveal={onReveal} />}
    </div>
  );
}

function Reveal({ onReveal }: { onReveal: () => void }) {
  return (
    <Button variant="ghost" className="mt-2 text-xs" onClick={onReveal}>
      Show answer & explanation
    </Button>
  );
}

function Explanation({ q }: { q: QuizQuestion }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-950">
      <p className="font-medium">Answer</p>
      <p className="mt-1">{q.correct_answer}</p>
      {q.explanation ? (
        <>
          <p className="mt-3 font-medium">Why</p>
          <p className="mt-1 text-emerald-900/90">{q.explanation}</p>
        </>
      ) : null}
    </div>
  );
}
