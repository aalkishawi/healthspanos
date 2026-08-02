// Centred card used by every unauthenticated account page, so signup, reset and
// invite acceptance are visually one flow rather than three separate screens.
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title, blurb, children, footer,
}: {
  title: string;
  blurb?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-2 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-sm font-bold uppercase tracking-widest text-accent">
          Numik HealthspanOS
        </Link>
        <div className="rounded-lg border border-border bg-surface p-7">
          <h1 className="text-xl font-semibold">{title}</h1>
          {blurb && <p className="mt-2 text-sm text-fg-muted">{blurb}</p>}
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-fg-muted">{footer}</div>}
        <p className="mt-6 text-center text-xs text-fg-muted">
          Numik HealthspanOS provides non-diagnostic wellness guidance. It is not medical advice.
        </p>
      </div>
    </main>
  );
}
