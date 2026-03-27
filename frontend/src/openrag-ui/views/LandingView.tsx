import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ThemeModeControl } from "@/components/ThemeModeControl";

const steps = [
  {
    icon: Upload,
    title: "Add a PDF",
    body: "Upload any book or paper. We index the text and structure so answers can point to real pages—not guesses from the model’s training data.",
  },
  {
    icon: MessageSquare,
    title: "Ask in plain language",
    body: "Chat, summaries, and notes stay grounded in what you uploaded. When we cite a passage, you can open it and verify in the original PDF.",
  },
  {
    icon: Target,
    title: "Learn with intent",
    body: "Highlights, quizzes, and progress live on your library. Come back to the same document and pick up where you left off.",
  },
] as const;

const outcomes = [
  "Less tab-hopping between PDF and AI tools",
  "Clearer “why should I trust this?” with sources",
  "A single place for reading + recall + practice",
];

export function LandingView() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 1) {
      setErr("Add your name or a nickname so we can personalize your library.");
      return;
    }
    setErr(null);
    login(n);
  };

  return (
    <div className="relative min-h-dvh bg-[var(--or-bg)] text-[var(--or-ink)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[min(420px,45vh)] bg-gradient-to-b from-[var(--or-accent-wash)]/80 to-transparent" />

      <header className="relative z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--or-ink)] text-[var(--or-cream)] shadow-or-card">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">OpenRAG</span>
        </div>
        <ThemeModeControl compact className="shrink-0" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-20 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-4">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--or-border)] bg-[var(--or-cream)] px-3 py-1 text-xs font-medium text-[var(--or-ink-muted)] shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--or-amber)]" />
              Reading + RAG, grounded in your sources
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--or-ink)] sm:text-5xl"
            >
              Turn PDFs into a study studio you’ll actually return to
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--or-ink-muted)]"
            >
              OpenRAG indexes <strong className="font-semibold text-[var(--or-ink)]">your</strong> documents, answers from{" "}
              <strong className="font-semibold text-[var(--or-ink)]">retrieved text</strong>, and keeps the original file one
              click away—so you stay oriented and skeptical in the right way.
            </motion.p>

            <ul className="mt-8 space-y-3 text-sm text-[var(--or-ink)]">
              {outcomes.map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--or-sage)]" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:pt-2"
          >
            <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-lift sm:p-8">
              <h2 className="font-display text-xl font-semibold text-[var(--or-ink)]">Start your workspace</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--or-ink-muted)]">
                No password in this demo—just a name so greetings and your library feel like yours. You can sign out anytime
                in Settings.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="or-display-name" className="text-xs font-semibold uppercase tracking-wide text-[var(--or-ink-muted)]">
                    What should we call you?
                  </label>
                  <input
                    id="or-display-name"
                    type="text"
                    autoComplete="nickname"
                    placeholder="e.g. Ravi"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErr(null);
                    }}
                    className="or-input mt-2 w-full rounded-xl px-4 py-3 text-base"
                  />
                </div>
                {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--or-ink)] py-3.5 text-sm font-semibold text-[var(--or-cream)] shadow-or-card transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  Open my library
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-5 border-t border-[var(--or-border)] pt-5 text-xs leading-relaxed text-[var(--or-ink-muted)]">
                Tip: after you sign in, upload a PDF from the library. Indexing runs in the background; you can open the reader
                as soon as the file is ready.
              </p>
            </div>
          </motion.div>
        </div>

        <section className="mt-20 border-t border-[var(--or-border)] pt-16">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--or-ink)] sm:text-3xl">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--or-ink-muted)]">
            Three steps. The point is simple: <span className="text-[var(--or-ink)]">your book stays the source of truth</span>
            ; the AI is a layer on top—not a replacement.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--or-amber)]/15 text-[var(--or-amber)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-[var(--or-ink)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--or-ink-muted)]">{body}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
