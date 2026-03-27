import { ModelAnswerMarkdown } from "@/components/ModelAnswerMarkdown";

/** Markdown + GFM for model answers (nested lists, **bold**, code, trailing “Sources used:” callout). */
export function AnswerProse({ text }: { text: string }) {
  return (
    <ModelAnswerMarkdown
      text={text}
      theme="workspace"
      className="answer-prose font-serif leading-[1.75] text-zinc-800"
    />
  );
}
