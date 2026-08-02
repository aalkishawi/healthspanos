import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DEFAULT_LOCALE, dirFor } from "@/lib/i18n";
import { appBaseUrl } from "@/lib/email";

const TITLE = "Numik HealthspanOS";
const DESCRIPTION =
  "Turn global longevity research into measurable workforce healthspan. Citation-backed, " +
  "non-diagnostic intelligence with a privacy boundary employers cannot cross.";

export const metadata: Metadata = {
  // `template` gives every child page "Page · Numik HealthspanOS" without each
  // page repeating the suffix and eventually disagreeing about it.
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  applicationName: TITLE,
  // Resolved from the RUNTIME base URL, so canonicals and OpenGraph point at the
  // deployment actually serving the page rather than a host baked in at build.
  metadataBase: new URL(appBaseUrl()),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    // Authenticated surfaces are excluded in robots.ts; this governs the public
    // pages that SHOULD be indexed.
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  category: "health",
};

export const viewport: Viewport = {
  themeColor: "#0c0e1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // English-first launch; dir/lang derive from locale scaffolding so switching to
  // Arabic later flips the whole document to RTL with no layout rewrites.
  const locale = DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={dirFor(locale)} data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
