import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ModelAnswerTheme = "openrag" | "workspace";

function splitSourcesBlock(trimmed: string): { main: string; sourcesLine: string | null } {
  const sourcesMatch = trimmed.match(/(?:^|\n\n)(Sources used:\s*[\s\S]*)$/i);
  if (sourcesMatch && sourcesMatch.index != null) {
    return {
      main: trimmed.slice(0, sourcesMatch.index).trim(),
      sourcesLine: sourcesMatch[1]?.trim() ?? null,
    };
  }
  return { main: trimmed, sourcesLine: null };
}

function markdownComponents(theme: ModelAnswerTheme): Components {
  const size = theme === "workspace" ? "text-[17px]" : "text-[15px]";
  const ink = theme === "openrag" ? "text-[var(--or-ink)]" : "text-zinc-800";
  const muted = theme === "openrag" ? "text-[var(--or-ink-muted)]" : "text-zinc-600";
  const strong =
    theme === "openrag" ? "font-semibold text-[var(--or-ink)]" : "font-semibold text-zinc-900";
  const marker = theme === "openrag" ? "marker:text-[var(--or-amber)]" : "marker:text-indigo-600";
  const codeBg =
    theme === "openrag"
      ? "bg-[var(--or-surface-muted)] text-[var(--or-ink)]"
      : "bg-zinc-100 text-zinc-900";
  const preBg =
    theme === "openrag"
      ? "bg-[var(--or-ink)] text-[var(--or-cream)]"
      : "bg-zinc-900 text-zinc-100";

  return {
    p: ({ children }) => (
      <p className={`mb-3 leading-[1.75] last:mb-0 ${size} ${ink}`}>{children}</p>
    ),
    h1: ({ children }) => (
      <h1 className={`mb-3 text-lg font-semibold tracking-tight ${strong}`}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className={`mb-2 mt-4 text-base font-semibold tracking-tight first:mt-0 ${strong}`}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`mb-2 mt-3 text-sm font-semibold first:mt-0 ${strong}`}>{children}</h3>
    ),
    ul: ({ children }) => (
      <ul className={`mb-3 list-disc space-y-1.5 pl-5 leading-relaxed ${size} ${ink} ${marker}`}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={`mb-3 list-decimal space-y-1.5 pl-5 leading-relaxed ${size} ${ink} ${marker}`}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0">{children}</li>,
    strong: ({ children }) => <strong className={strong}>{children}</strong>,
    em: ({ children }) => <em className={`italic ${muted}`}>{children}</em>,
    blockquote: ({ children }) => (
      <blockquote
        className={`mb-3 border-l-4 pl-3 leading-relaxed ${size} ${
          theme === "openrag"
            ? "border-[var(--or-amber)]/40 text-[var(--or-ink-muted)]"
            : "border-indigo-200 text-zinc-600"
        }`}
      >
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className={`font-medium underline underline-offset-2 ${
          theme === "openrag" ? "text-[var(--or-amber)]" : "text-indigo-600"
        }`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    hr: () => (
      <hr
        className={`my-4 border-0 border-t ${
          theme === "openrag" ? "border-[var(--or-border)]" : "border-zinc-200"
        }`}
      />
    ),
    pre: ({ children }) => (
      <pre className={`mb-3 overflow-x-auto rounded-xl p-3 text-[13px] leading-relaxed ${preBg}`}>
        {children}
      </pre>
    ),
    code: ({ className, children }) => {
      const isBlock = Boolean(className?.includes("language-"));
      if (isBlock) {
        return <code className={`block font-mono text-[13px] ${className ?? ""}`}>{children}</code>;
      }
      return (
        <code className={`rounded px-1 py-0.5 font-mono text-[0.88em] ${codeBg}`}>{children}</code>
      );
    },
  };
}

type Props = {
  text: string;
  theme?: ModelAnswerTheme;
  /** Extra wrapper classes (e.g. workspace serif) */
  className?: string;
};

/** Renders model answers with Markdown + GFM (lists, nested lists, **bold**, etc.). Pulls trailing “Sources used:” into a callout. */
export function ModelAnswerMarkdown({ text, theme = "openrag", className = "" }: Props) {
  const trimmed = text.trim();
  const { main, sourcesLine } = splitSourcesBlock(trimmed);
  const components = markdownComponents(theme);

  const sourcesBox =
    theme === "openrag" ? (
      <p className="mt-4 rounded-xl border border-[var(--or-amber)]/25 bg-[var(--or-accent-wash)] px-4 py-3 text-[13px] leading-relaxed text-[var(--or-ink)]">
        <span className="font-semibold text-[var(--or-ink)]">Sources</span>
        <span className="mx-1.5 text-[var(--or-ink-muted)]">·</span>
        <span className="text-[var(--or-ink-muted)]">
          {sourcesLine!.replace(/^sources used:\s*/i, "")}
        </span>
      </p>
    ) : (
      <p className="mt-6 rounded-xl border border-indigo-100/80 bg-indigo-50/50 px-4 py-3 text-[13px] leading-relaxed text-indigo-950/90">
        <span className="font-semibold text-indigo-800">Sources</span>
        <span className="mx-1.5 text-indigo-300">·</span>
        <span className="text-indigo-900/85">{sourcesLine!.replace(/^sources used:\s*/i, "")}</span>
      </p>
    );

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {main}
      </ReactMarkdown>
      {sourcesLine ? sourcesBox : null}
    </div>
  );
}
