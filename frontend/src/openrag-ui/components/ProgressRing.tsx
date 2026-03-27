import { motion } from "framer-motion";

/** Log-scaled 0–100 from event counts (see `engagementPercent` in context). Not file upload % */
export function ProgressRing({
  percent,
  size = 52,
  stroke = 4,
  title,
  centerLabel,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  /** Native tooltip (e.g. explain this is activity, not upload) */
  title?: string;
  /** Override center text (default `N%`) */
  centerLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }} title={title}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--or-ring-track)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--or-amber)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center px-0.5 text-center font-mono text-[9px] font-semibold leading-tight text-[var(--or-ink)]"
        style={{ fontFamily: "var(--or-font-mono)" }}
      >
        {centerLabel ?? `${Math.round(percent)}%`}
      </span>
    </div>
  );
}
