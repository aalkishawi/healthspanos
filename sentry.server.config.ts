// Sentry — server runtime. No-op when SENTRY_DSN is unset, so local dev and CI
// run without an account and without noise.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // This app handles PHI. Never let Sentry collect request bodies, headers,
    // cookies or IPs by default — an error report must not become a breach.
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.request?.cookies;
      delete event.request?.data;
      if (event.request?.headers) delete event.request.headers;
      return event;
    },
  });
}
