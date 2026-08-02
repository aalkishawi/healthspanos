import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DEFAULT_LOCALE, dirFor } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Numik HealthspanOS",
  description: "The longevity intelligence operating system for the enterprise.",
  manifest: "/manifest.webmanifest",
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
