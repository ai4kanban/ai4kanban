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
        // Render-only pages that exist purely to be screenshot: the OG card, and
        // the loop drawings the READMEs embed from the CDN.
        "/og-image/",
        "/shots/",
        // The design system reference — a tool for building the site, not a page.
        "/design/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
