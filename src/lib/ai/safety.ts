// What the assistant is allowed to answer, decided BEFORE any model is called.
//
// This runs first for two reasons: a question we must not answer should not cost
// a model call, and — more importantly — a refusal must not depend on a model
// choosing to refuse. The guardrail is deterministic code, not a prompt
// instruction the model may or may not follow.
//
// The classification is intentionally CONSERVATIVE and errs toward escalation.
// A general question wrongly escalated is a small annoyance; an individual
// medical question wrongly answered is the failure this product cannot have.

export type SafetyVerdict =
  | { action: "answer" }
  | { action: "escalate"; reason: string; message: string }
  | { action: "block"; reason: string; message: string };

// Immediate-risk language. These get a direct signpost to emergency care and
// never reach a model — latency matters and so does not burying it in prose.
const EMERGENCY = [
  /\bchest pain\b/i,
  /\bcan'?t breathe\b/i, /\btrouble breathing\b/i, /\bshortness of breath\b/i,
  /\bsuicid/i, /\bkill myself\b/i, /\bend my life\b/i, /\bself[- ]harm\b/i,
  /\bstroke\b/i, /\bheart attack\b/i,
  /\boverdose\b/i, /\bpoison/i,
  /\bsevere bleeding\b/i, /\bunconscious\b/i,
];

// Individual clinical questions. Answering these is practising medicine.
const INDIVIDUAL_MEDICAL = [
  /\bdo I have\b/i, /\bam I (having|at risk of)\b/i, /\bis (this|it) (cancer|serious|normal)\b/i,
  /\bdiagnos/i, /\bwhat'?s wrong with me\b/i,
  /\bshould I (stop|start|take|increase|decrease|double)\b.*\b(medication|meds|drug|dose|dosage|pill|statin|insulin|metformin|warfarin|antidepressant)\b/i,
  /\b(dose|dosage|mg|milligram)\b.*\b(should|take|safe)\b/i,
  /\bmy (test|blood|lab) results?\b/i,
  /\breplace my (medication|treatment|prescription)\b/i,
  /\btreat my\b/i, /\bcure my\b/i,
];

// Out of scope. Not unsafe, just not what this is.
const OUT_OF_SCOPE = [
  /\bignore (all )?(previous|prior|above) instructions?\b/i,
  /\bsystem prompt\b/i,
  /\byou are now\b/i,
];

const EMERGENCY_MESSAGE =
  "This sounds like it could be urgent. Numik HealthspanOS cannot help with medical emergencies. " +
  "Please contact your local emergency number or go to an emergency department now. " +
  "If you are in crisis and need someone to talk to, contact a local crisis line immediately.";

const ESCALATION_MESSAGE =
  "This is a question about your individual medical care, which Numik cannot answer — we provide " +
  "non-diagnostic, general lifestyle information only. Your question has been routed to our " +
  "clinical review team, and you should also raise it with your own doctor, who can see your full " +
  "history.";

const OUT_OF_SCOPE_MESSAGE =
  "I can only help with general questions about longevity, preventive health and healthy-ageing " +
  "research, answered from our reviewed evidence base.";

/**
 * Decide what to do with a question before spending a model call on it.
 *
 * Order matters: emergency beats everything, then individual medical, then
 * scope. A question containing both "chest pain" and "should I take aspirin"
 * must produce the emergency response, not the escalation one.
 */
export function classify(question: string): SafetyVerdict {
  const q = question.trim();

  for (const re of EMERGENCY) {
    if (re.test(q)) {
      return {
        action: "block",
        reason: `emergency-language:${re.source.slice(0, 40)}`,
        message: EMERGENCY_MESSAGE,
      };
    }
  }
  for (const re of INDIVIDUAL_MEDICAL) {
    if (re.test(q)) {
      return {
        action: "escalate",
        reason: `individual-medical:${re.source.slice(0, 40)}`,
        message: ESCALATION_MESSAGE,
      };
    }
  }
  for (const re of OUT_OF_SCOPE) {
    if (re.test(q)) {
      return { action: "block", reason: "out-of-scope", message: OUT_OF_SCOPE_MESSAGE };
    }
  }
  return { action: "answer" };
}

/** Appended to every answer that does get produced. */
export const NON_DIAGNOSTIC_FOOTER =
  "This is general, non-diagnostic information drawn from published research — not medical advice, " +
  "and not specific to your circumstances. Talk to a qualified clinician about your own health.";

/**
 * Last-line check on generated text.
 *
 * The prompt forbids individual advice, but a prompt is a request, not a
 * guarantee. If the model produced prescriptive personal direction anyway, we
 * would rather withhold the answer than ship it.
 */
export function outputLooksPrescriptive(answer: string): boolean {
  return [
    /\byou should (take|stop|start|increase|decrease)\b.*\b(medication|dose|drug|mg)\b/i,
    /\bI diagnose\b/i,
    /\byou (have|are suffering from) (a|an)?\s*\b(condition|disease|disorder|cancer|diabetes)\b/i,
    /\bstop taking your\b/i,
  ].some((re) => re.test(answer));
}
