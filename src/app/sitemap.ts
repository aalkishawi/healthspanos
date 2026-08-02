import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/email";

// Public pages only. Authenticated portals are deliberately absent: they are
// behind a login, they hold health data, and listing them invites crawling.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appBaseUrl();
  const now = new Date();
  const routes = [
    { path: "/", priority: 1.0, freq: "weekly" as const },
    { path: "/pricing", priority: 0.9, freq: "monthly" as const },
    { path: "/about", priority: 0.7, freq: "monthly" as const },
    { path: "/contact", priority: 0.7, freq: "monthly" as const },
    { path: "/signup", priority: 0.8, freq: "monthly" as const },
    { path: "/legal/privacy", priority: 0.4, freq: "yearly" as const },
    { path: "/legal/terms", priority: 0.4, freq: "yearly" as const },
    { path: "/legal/security", priority: 0.5, freq: "yearly" as const },
  ];
  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
