import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/site";

// Required for `output: export` — emit robots.txt at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Render-only page that exists purely to be screenshot into the OG card.
        "/og-image/",
        // The design system reference — a tool for building the site, not a page.
        "/design/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
