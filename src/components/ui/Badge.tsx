import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "accent" | "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  accent: "bg-[var(--accent-soft)] text-fg",
  neutral: "bg-surface-3 text-fg-muted",
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  danger: "bg-[color:var(--danger)]/15 text-[color:var(--danger)]",
  info: "bg-[color:var(--info)]/15 text-[color:var(--info)]",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
