/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// Sentry needs to POST envelopes to its ingest host; only allow it when
// configured, so a deployment without Sentry keeps the tighter policy.
const sentryOrigin = (() => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";
  try {
    return dsn ? new URL(dsn).origin : "";
  } catch {
    return "";
  }
})();

// Content-Security-Policy.
//
// `'unsafe-inline'` on script-src is a deliberate, documented compromise: the
// Next 15 App Router emits inline bootstrap/hydration scripts, and removing it
// requires per-request nonces, which are incompatible with the static
// optimization this app relies on. Everything else is locked to 'self'. When
// the app moves to fully dynamic rendering, switch to a nonce and drop this.
// 'unsafe-eval' is dev-only (React Refresh needs it) and never ships to prod.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",           // Tailwind injects inline styles
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${sentryOrigin ? ` ${sentryOrigin}` : ""}${isProd ? "" : " ws: http://localhost:*"}`,
  "frame-ancestors 'none'",                      // stronger than X-Frame-Options
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Cross-origin isolation: this app serves PHI-adjacent data, so no other
  // origin should be able to read or embed its responses.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// HSTS only in production. Sending it from http://localhost would pin the
// browser to HTTPS for localhost and break every other local dev server.
if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  reactStrictMode: true,
  // HealthspanOS handles PHI-adjacent data; harden default response headers.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses must never be cached by a shared/CDN cache — they are
      // per-user and tenant-scoped.
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
