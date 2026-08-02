// One domain score with its generated explanation.
//
// The explanation is always shown, not hidden behind a tooltip: a number
// presented without its reasoning is exactly the opaque health score this
// product is meant not to be.
import { Badge } from "@/components/ui/Badge";

const BAND_TONE = { optimal: "success", moderate: "warning", low: "danger" } as const;

export function ScoreCard({
  domain, score, band, explanation, computedAt,
}: {
  domain: string;
  score: number;
  band: string;
  explanation: string;
  computedAt: Date;
}) {
  const tone = BAND_TONE[band as keyof typeof BAND_TONE] ?? "neutral";
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold capitalize">{domain}</h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            Updated {computedAt.toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{score}</div>
          <Badge tone={tone}>{band}</Badge>
        </div>
      </div>
      {/* Progress rail — visual only, mirrors the number beside it. */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(2, score)}%` }}
          role="presentation"
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{explanation}</p>
    </div>
  );
}
