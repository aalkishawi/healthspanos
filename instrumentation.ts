// Next.js loads this once per runtime at boot. Sentry's Next SDK relies on it
// to initialise the server and edge runtimes.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(...args: unknown[]) {
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error - signature is version-dependent; forward verbatim.
  return Sentry.captureRequestError?.(...args);
}
