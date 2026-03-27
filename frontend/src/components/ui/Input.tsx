import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-shadow focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-shadow focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...props}
    />
  );
}
