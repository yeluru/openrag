import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { generateQuiz, submitQuizAttempt } from "@/api/openrag";
import type { QuizQuestion } from "@/api/types";
import { humanApiError } from "@/api/client";
import { ThemeModeControl } from "@/components/ThemeModeControl";
import { useOpenRAG } from "../context/OpenRAGContext";

type Phase = "setup" | "session" | "results";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function boolMatch(user: string, correct: string): boolean {
  let u = norm(user);
  let c = norm(correct);
  if (["t", "true", "yes", "1"].includes(u)) u = "true";
  if (["f", "false", "no", "0"].includes(u)) u = "false";
  if (["t", "true", "yes", "1"].includes(c)) c = "true";
  if (["f", "false", "no", "0"].includes(c)) c = "false";
  return u === c;
}

function parseOptions(q: QuizQuestion): string[] {
  const o = q.options;
  if (Array.isArray(o)) return o.map(String);
  if (o && typeof o === "object" && "choices" in o && Array.isArray((o as { choices: unknown }).choices)) {
    return (o as { choices: string[] }).choices.map(String);
  }
  return [];
}

function gradeLocal(q: QuizQuestion, raw: string): boolean | null {
  if (q.question_type === "short_answer" || q.question_type === "concept_explanation") return null;
  if (q.question_type === "true_false") return boolMatch(raw, q.correct_answer);
  return norm(raw) === norm(q.correct_answer);
}

export function QuizView() {
  const { userId, activeDocId, documents, goLibrary, pushToast } = useOpenRAG();
  const doc = documents.find((d) => d.id === activeDocId);
  const [phase, setPhase] = useState<Phase>("setup");
  const [numQ, setNumQ] = useState<5 | 10 | 20>(5);
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [qTypes, setQTypes] = useState<string[]>(["multiple_choice", "true_false", "short_answer"]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [scorePct, setScorePct] = useState<number | null>(null);
  const [perQ, setPerQ] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  const q = questions[index];

  const resultsChart: { name: string; value: number }[] = useMemo(() => {
    if (!perQ || !questions.length) {
      return [
        { name: "Correct", value: 0 },
        { name: "Incorrect", value: 0 },
        { name: "Open-ended", value: 0 },
      ];
    }
    let ok = 0;
    let bad = 0;
    let skip = 0;
    for (const qq of questions) {
      const v = perQ[qq.id];
      if (v === true) ok++;
      else if (v === false) bad++;
      else skip++;
    }
    return [
      { name: "Correct", value: ok },
      { name: "Incorrect", value: bad },
      { name: "Open-ended", value: skip },
    ];
  }, [perQ, questions]);

  if (!activeDocId) {
    goLibrary();
    return null;
  }

  const start = async () => {
    setGenErr(null);
    setLoading(true);
    try {
      const res = await generateQuiz(userId, {
        scope: { document_id: activeDocId },
        num_questions: numQ,
        difficulty,
        question_types: qTypes.length ? qTypes : null,
      });
      setQuizId(res.quiz_id);
      setQuestions(res.questions);
      setPhase("session");
      setIndex(0);
      setAnswers({});
      setSelected("");
      setConfirmed(false);
      setScorePct(null);
      setPerQ({});
    } catch (e) {
      setGenErr(humanApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const currentAnswer = (): string => {
    if (!q) return "";
    if (q.question_type === "true_false") return selected;
    return selected;
  };

  const confirm = () => {
    if (!q || confirmed) return;
    const ans = currentAnswer();
    if (!ans.trim() && q.question_type !== "short_answer" && q.question_type !== "concept_explanation") return;
    setAnswers((a) => ({ ...a, [q.id]: ans }));
    setConfirmed(true);
  };

  const finish = async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const merged = { ...answers };
      const cur = questions[index];
      if (cur) merged[cur.id] = merged[cur.id] ?? currentAnswer();
      const sub = await submitQuizAttempt(userId, quizId, merged);
      setScorePct(sub.score);
      setPerQ(sub.per_question);
      setPhase("results");
      pushToast("Quiz submitted.");
    } catch (e) {
      pushToast(humanApiError(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (!q || !confirmed) return;
    const nextIdx = index + 1;
    if (nextIdx >= questions.length) {
      void finish();
      return;
    }
    setIndex(nextIdx);
    setSelected(answers[questions[nextIdx].id] || "");
    setConfirmed(false);
  };

  const lastGrade = q && confirmed ? gradeLocal(q, answers[q.id] ?? currentAnswer()) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--or-bg)]">
      <header className="flex items-center gap-3 border-b border-[var(--or-border)] bg-[var(--or-cream)] px-4 py-3">
        <button
          type="button"
          onClick={goLibrary}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--or-ink-muted)] hover:bg-black/[0.04]"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold">Quiz · {doc?.title}</h1>
          <p className="text-xs capitalize text-[var(--or-ink-muted)]">{difficulty}</p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <ThemeModeControl compact />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === "setup" ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto w-full max-w-lg flex-1 px-4 py-10"
          >
            <h2 className="font-display text-2xl font-semibold">Quiz setup</h2>
            <p className="mt-2 text-sm text-[var(--or-ink-muted)]">Generated from your document via the OpenRAG API.</p>
            {genErr ? <p className="mt-4 text-sm text-red-600">{genErr}</p> : null}

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--or-ink-muted)]">Questions</p>
                <div className="mt-2 flex gap-2">
                  {([5, 10, 20] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumQ(n)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                        numQ === n ? "bg-[var(--or-ink)] text-[var(--or-cream)]" : "bg-[var(--or-cream)] ring-1 ring-[var(--or-border)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--or-ink-muted)]">Difficulty</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                        difficulty === d
                          ? "bg-[var(--or-amber)]/25 text-[var(--or-ink)] ring-2 ring-[var(--or-amber)]"
                          : "bg-[var(--or-cream)] ring-1 ring-[var(--or-border)]"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--or-ink-muted)]">Types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { id: "multiple_choice", label: "MCQ" },
                    { id: "true_false", label: "True / False" },
                    { id: "short_answer", label: "Short answer" },
                  ].map(({ id, label }) => {
                    const on = qTypes.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setQTypes((t) => (on ? t.filter((x) => x !== id) : [...t, id]))}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          on ? "bg-[var(--or-sage)]/30 text-[var(--or-ink)]" : "bg-[var(--or-bg)] ring-1 ring-[var(--or-border)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={qTypes.length === 0 || loading}
              onClick={() => void start()}
              className="mt-10 w-full rounded-[12px] bg-[var(--or-ink)] py-3.5 font-semibold text-[var(--or-cream)] shadow-or-card disabled:opacity-40"
            >
              {loading ? "Generating…" : "Start quiz"}
            </button>
          </motion.div>
        ) : null}

        {phase === "session" && q ? (
          <motion.div
            key={`q-${index}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8"
          >
            <div className="mb-6">
              <div className="mb-2 flex justify-between font-mono text-xs text-[var(--or-ink-muted)]">
                <span>
                  Q{index + 1} of {questions.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--or-cream)] ring-1 ring-[var(--or-border)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--or-amber)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${((index + (confirmed ? 1 : 0)) / questions.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>

            <motion.div className="or-card flex-1 rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card md:p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--or-amber)]">
                {q.question_type.replace(/_/g, " ")}
              </p>
              <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-[var(--or-ink)]">{q.question_text}</h3>

              {q.question_type === "multiple_choice" ? (
                <ul className="mt-6 space-y-2">
                  {parseOptions(q).map((opt) => {
                    const isSel = norm(selected) === norm(opt);
                    const show = confirmed;
                    const isCor = norm(opt) === norm(q.correct_answer);
                    return (
                      <li key={opt}>
                        <button
                          type="button"
                          disabled={confirmed}
                          onClick={() => setSelected(opt)}
                          className={`flex w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                            show && isCor
                              ? "border-[var(--or-sage)] bg-[var(--or-sage)]/20"
                              : show && isSel && !isCor
                                ? "border-red-300 bg-red-50"
                                : isSel
                                  ? "border-[var(--or-amber)] bg-[var(--or-amber)]/10"
                                  : "border-[var(--or-border)] hover:border-[var(--or-amber)]/40"
                          }`}
                        >
                          {opt}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {q.question_type === "true_false" ? (
                <div className="mt-6 flex gap-3">
                  {["true", "false"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={confirmed}
                      onClick={() => setSelected(v)}
                      className={`flex-1 rounded-xl border py-3 text-sm font-semibold capitalize ${
                        norm(selected) === v ? "border-[var(--or-amber)] bg-[var(--or-amber)]/10" : "border-[var(--or-border)]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : null}

              {(q.question_type === "short_answer" || q.question_type === "concept_explanation") && (
                <textarea
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={confirmed}
                  rows={4}
                  placeholder="Your answer…"
                  className="or-input mt-6 w-full rounded-[12px] p-3 text-sm"
                />
              )}

              {confirmed ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 rounded-[12px] border p-4 ${
                    lastGrade === true
                      ? "border-[var(--or-sage)]/50 bg-[var(--or-sage)]/10"
                      : lastGrade === false
                        ? "border-red-200 bg-red-50/60"
                        : "border-[var(--or-border)] bg-[var(--or-bg)]"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-[var(--or-ink)]">
                    {lastGrade === true ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--or-sage)]" />
                    ) : lastGrade === false ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : null}
                    {lastGrade === true ? "Correct" : lastGrade === false ? "Incorrect" : "Recorded (open-ended)"}
                  </div>
                  {q.explanation ? <p className="mt-2 text-sm leading-relaxed text-[var(--or-ink)]">{q.explanation}</p> : null}
                </motion.div>
              ) : null}

              <div className="mt-8 flex gap-3">
                {!confirmed ? (
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={
                      q.question_type === "multiple_choice"
                        ? !selected
                        : q.question_type === "true_false"
                          ? !selected
                          : false
                    }
                    className="flex-1 rounded-[12px] bg-[var(--or-ink)] py-3 font-semibold text-[var(--or-cream)] disabled:opacity-40"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void next()}
                    className="flex-1 rounded-[12px] bg-[var(--or-amber)] py-3 font-semibold text-white disabled:opacity-40"
                  >
                    {index + 1 >= questions.length ? "Submit quiz" : "Next"}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {phase === "results" && scorePct != null ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto w-full max-w-2xl flex-1 px-4 py-10"
          >
            <div className="or-card rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-8 text-center shadow-or-card">
              <h2 className="font-display text-3xl font-semibold">Score {scorePct.toFixed(0)}%</h2>
              <p className="mt-1 font-mono text-sm text-[var(--or-ink-muted)]">Auto-graded questions only</p>
            </div>

            <div className="or-card mt-8 rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card">
              <h3 className="font-display text-lg font-semibold">Breakdown</h3>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resultsChart} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--or-border)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--or-ink-muted)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--or-ink-muted)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--or-border)",
                        background: "var(--or-cream)",
                      }}
                    />
                    <Bar dataKey="value" fill="var(--or-amber)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPhase("setup");
                setQuizId(null);
                setQuestions([]);
              }}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] py-3 font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              New quiz
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
