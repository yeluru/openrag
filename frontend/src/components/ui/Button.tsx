import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm disabled:opacity-50 disabled:hover:bg-zinc-900",
  secondary:
    "bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 shadow-sm disabled:opacity-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
