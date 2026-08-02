"use client";
// Multi-step intake. Client-side for step navigation only — the payload is
// re-validated server-side against the same Zod schema (src/lib/intake.ts), so
// nothing here is a trust boundary.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Select, TextInput } from "@/components/ui/Field";
import {
  ACTIVITY_LEVELS, ALCOHOL, DIET_PATTERNS, GOALS, INTAKE_STEPS, IntakeSchema,
  SMOKING, STRESS_LEVELS,
} from "@/lib/intake";

type Draft = {
  goals: string[];
  sleep: { averageHours: number; quality: number; wakesDuringNight: boolean };
  activity: { level: string; sessionsPerWeek: number; averageDailySteps: number };
  lifestyle: { diet: string; smoking: string; alcohol: string; stress: string };
  about: { birthYear?: number; sex?: string };
};

// Neutral starting values. Deliberately mid-range rather than flattering, and
// every one is overwritten by the member before submit — these are form
// defaults, not data, and nothing is persisted until the member submits.
const EMPTY: Draft = {
  goals: [],
  sleep: { averageHours: 7, quality: 3, wakesDuringNight: false },
  activity: { level: "moderate", sessionsPerWeek: 2, averageDailySteps: 6000 },
  lifestyle: { diet: "mixed", smoking: "never", alcohol: "occasional", stress: "moderate" },
  about: {},
};

export function OnboardingWizard({ initial }: { initial: unknown }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => merge(EMPTY, initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = INTAKE_STEPS[step]!;
  const isLast = step === INTAKE_STEPS.length - 1;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function next() {
    // Only the goals step has a hard requirement; the rest have valid defaults.
    if (current.key === "goals" && draft.goals.length === 0) {
      return setError("Pick at least one focus area.");
    }
    setError(null);
    setStep((s) => Math.min(s + 1, INTAKE_STEPS.length - 1));
  }

  async function submit() {
    setError(null);
    const parsed = IntakeSchema.safeParse(draft);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return setError(i ? `${i.path.join(" › ")}: ${i.message}` : "Check your answers.");
    }
    setBusy(true);
    const res = await fetch("/api/member/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not save your answers.");
    router.push(data.redirect ?? "/member/passport");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <ol className="mb-6 flex gap-2" aria-label="Onboarding progress">
        {INTAKE_STEPS.map((s, i) => (
          <li key={s.key} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-surface-3"}`}
              aria-current={i === step ? "step" : undefined}
            />
            <span className="sr-only">{s.title}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          Step {step + 1} of {INTAKE_STEPS.length}
        </p>
        <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
        <p className="mt-1 text-sm text-fg-muted">{current.blurb}</p>

        <div className="mt-6 space-y-5">
          {current.key === "goals" && (
            <fieldset>
              <legend className="mb-2 text-sm text-fg-muted">Choose everything that applies.</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const on = draft.goals.includes(g);
                  return (
                    <label
                      key={g}
                      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm capitalize ${
                        on ? "border-accent bg-accent/10" : "border-border bg-surface"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-[var(--accent)]"
                        checked={on}
                        onChange={() =>
                          set("goals", on ? draft.goals.filter((x) => x !== g) : [...draft.goals, g])
                        }
                      />
                      {g}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {current.key === "sleep" && (
            <>
              <Field label="Average hours of sleep a night" htmlFor="averageHours">
                <TextInput
                  id="averageHours" type="number" min={0} max={24} step={0.5}
                  value={draft.sleep.averageHours}
                  onChange={(e) => set("sleep", { ...draft.sleep, averageHours: Number(e.target.value) })}
                />
              </Field>
              <Field label="Sleep quality" htmlFor="quality" hint="1 = poor, 5 = excellent">
                <Select
                  id="quality" value={draft.sleep.quality}
                  onChange={(e) => set("sleep", { ...draft.sleep, quality: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox" className="accent-[var(--accent)]"
                  checked={draft.sleep.wakesDuringNight}
                  onChange={(e) => set("sleep", { ...draft.sleep, wakesDuringNight: e.target.checked })}
                />
                I usually wake during the night
              </label>
            </>
          )}

          {current.key === "activity" && (
            <>
              <Field label="Overall activity level" htmlFor="level">
                <Select
                  id="level" value={draft.activity.level}
                  onChange={(e) => set("activity", { ...draft.activity, level: e.target.value })}
                >
                  {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Structured exercise sessions per week" htmlFor="sessionsPerWeek">
                <TextInput
                  id="sessionsPerWeek" type="number" min={0} max={21}
                  value={draft.activity.sessionsPerWeek}
                  onChange={(e) => set("activity", { ...draft.activity, sessionsPerWeek: Number(e.target.value) })}
                />
              </Field>
              <Field label="Typical daily steps" htmlFor="averageDailySteps" hint="A rough estimate is fine.">
                <TextInput
                  id="averageDailySteps" type="number" min={0} max={60000} step={500}
                  value={draft.activity.averageDailySteps}
                  onChange={(e) => set("activity", { ...draft.activity, averageDailySteps: Number(e.target.value) })}
                />
              </Field>
            </>
          )}

          {current.key === "lifestyle" && (
            <>
              <Field label="Diet pattern" htmlFor="diet">
                <Select id="diet" value={draft.lifestyle.diet}
                  onChange={(e) => set("lifestyle", { ...draft.lifestyle, diet: e.target.value })}>
                  {DIET_PATTERNS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Smoking" htmlFor="smoking">
                <Select id="smoking" value={draft.lifestyle.smoking}
                  onChange={(e) => set("lifestyle", { ...draft.lifestyle, smoking: e.target.value })}>
                  {SMOKING.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Alcohol" htmlFor="alcohol">
                <Select id="alcohol" value={draft.lifestyle.alcohol}
                  onChange={(e) => set("lifestyle", { ...draft.lifestyle, alcohol: e.target.value })}>
                  {ALCOHOL.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
              <Field label="Typical stress level" htmlFor="stress">
                <Select id="stress" value={draft.lifestyle.stress}
                  onChange={(e) => set("lifestyle", { ...draft.lifestyle, stress: e.target.value })}>
                  {STRESS_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </>
          )}

          {current.key === "about" && (
            <>
              <p className="text-sm text-fg-muted">
                Both optional. They sharpen your results, and leaving them blank does not block anything.
              </p>
              <Field label="Year of birth" htmlFor="birthYear" hint="Year only — we don't need your full date of birth.">
                <TextInput
                  id="birthYear" type="number" min={1900} max={new Date().getFullYear()}
                  value={draft.about.birthYear ?? ""}
                  onChange={(e) =>
                    set("about", { ...draft.about, birthYear: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Sex" htmlFor="sex">
                <Select
                  id="sex" value={draft.about.sex ?? ""}
                  onChange={(e) => set("about", { ...draft.about, sex: e.target.value || undefined })}
                >
                  <option value="">Prefer not to answer</option>
                  {["female", "male", "intersex", "prefer not to say"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>

        {error && <div className="mt-4"><FormMessage tone="error">{error}</FormMessage></div>}

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
            Back
          </Button>
          {isLast ? (
            <Button size="lg" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Finish and build my passport"}
            </Button>
          ) : (
            <Button size="lg" onClick={next} disabled={busy}>Continue</Button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-fg-muted">
        These answers are yours. They are used to build your passport and are never shown to an
        employer in identifiable form. Non-diagnostic — not medical advice.
      </p>
    </div>
  );
}

/** Re-hydrate a partially completed intake so a member can resume. */
function merge(base: Draft, saved: unknown): Draft {
  if (!saved || typeof saved !== "object") return base;
  const s = saved as Partial<Draft>;
  return {
    goals: Array.isArray(s.goals) ? s.goals : base.goals,
    sleep: { ...base.sleep, ...(s.sleep ?? {}) },
    activity: { ...base.activity, ...(s.activity ?? {}) },
    lifestyle: { ...base.lifestyle, ...(s.lifestyle ?? {}) },
    about: { ...base.about, ...(s.about ?? {}) },
  };
}
