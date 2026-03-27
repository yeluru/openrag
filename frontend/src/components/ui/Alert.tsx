import { AlertCircle, Info } from "lucide-react";

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-indigo-100 bg-indigo-50/80 text-indigo-950",
    warning: "border-amber-100 bg-amber-50/80 text-amber-950",
    error: "border-red-100 bg-red-50/80 text-red-950",
  };
  const Icon = variant === "error" ? AlertCircle : Info;
  return (
    <div
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={title ? "mt-1 text-opacity-90" : ""}>{children}</div>
      </div>
    </div>
  );
}
