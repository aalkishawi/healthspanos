import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/email";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Everything holding member data is disallowed. Crawlers cannot get
        // past the login anyway, but a disallow keeps these paths out of logs,
        // out of search suggestions, and out of scraped URL lists.
        disallow: [
          "/api/",
          "/member/",
          "/enterprise/",
          "/reviewer/",
          "/admin/",
          "/billing",
          "/verify-email",
          "/reset-password",
          "/accept-invite",
        ],
      },
    ],
    sitemap: `${appBaseUrl()}/sitemap.xml`,
  };
}
