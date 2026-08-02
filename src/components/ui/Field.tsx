// Shared form field. Every auth and onboarding form uses this so labels,
// focus rings, error wiring and accessibility behave identically — and so a
// fix to any of that lands everywhere at once.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60";

export function Field({
  label, htmlFor, hint, error, children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-fg-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs text-[color:var(--danger)]">{error}</p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, className)} {...props} />;
}

/** Inline status line. `tone` drives colour so callers don't hardcode hex. */
export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const colour =
    tone === "error"
      ? "text-[color:var(--danger)]"
      : tone === "success"
        ? "text-[color:var(--success)]"
        : "text-fg-muted";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("text-sm", colour)}>
      {children}
    </p>
  );
}
