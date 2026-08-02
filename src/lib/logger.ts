// Structured logging. One JSON object per line so Vercel/Datadog/CloudWatch can
// parse fields instead of regexing prose.
//
// PHI RULE: this app logs health data's *shape*, never its content. Do not pass
// intake answers, scores, questions, or free text into `fields`. Identify a
// member by id, never by email or name. `redact()` below is the escape hatch
// when a value must be referenced but not recorded.
import * as Sentry from "@sentry/nextjs";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

// Keys whose values must never reach a log line, whatever the caller passes.
const FORBIDDEN = new Set([
  "password", "passwordhash", "token", "secret", "authorization", "cookie",
  "intake", "question", "answer", "explanation", "email", "fullname",
  "dateofbirth", "sex",
]);

function scrub(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = FORBIDDEN.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

/** Note that a value existed without recording it. */
export function redact(value: unknown): string {
  if (value === null || value === undefined) return "[absent]";
  const s = String(value);
  return `[redacted:${s.length}]`;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...scrub(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  /**
   * Log an error AND report it to Sentry (no-op when Sentry is unconfigured).
   * Keeps the two from drifting apart — one call, both destinations.
   */
  error: (event: string, err?: unknown, fields?: LogFields) => {
    emit("error", event, { ...fields, err: err instanceof Error ? err.message : String(err ?? "") });
    if (err !== undefined) {
      Sentry.captureException(err, { tags: { event }, extra: scrub(fields ?? {}) });
    } else {
      Sentry.captureMessage(event, { level: "error", extra: scrub(fields ?? {}) });
    }
  },
};

/** True when Sentry has a DSN configured — surfaced by /api/health. */
export function sentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}
