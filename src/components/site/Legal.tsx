// Shared shell for legal pages.
//
// `LegalNotice` is mandatory on every one of them. These pages accurately
// describe what the system does, but they have NOT been reviewed by a lawyer
// (PRODUCTION_BUILD_PLAN Phase 7). Publishing them without saying so would
// present unreviewed text as a binding commitment — the notice makes the status
// impossible to miss, for visitors and for us.
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-fg-muted">Version {updated}</p>
      <div className="legal-prose mt-8 space-y-4 text-sm leading-relaxed text-fg-muted [&_code]:text-fg [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ms-5 [&_li]:list-disc [&_strong]:text-fg [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}

export function LegalNotice() {
  return (
    <div className="rounded border border-[color:var(--warning)] bg-[color:var(--warning)]/10 p-4">
      <p className="text-sm font-semibold text-fg">Draft — pending legal review</p>
      <p className="mt-1 text-sm text-fg-muted">
        This page is an accurate description of how the product currently handles data, written by
        the engineering team and checked against the implementation. It has <strong>not</strong> been
        reviewed by a lawyer and is not yet a binding legal agreement. Numik must not accept real
        member health data in production until a health-tech lawyer has reviewed these pages, the
        data-processing agreement, and the wording of every health claim.
      </p>
    </div>
  );
}
