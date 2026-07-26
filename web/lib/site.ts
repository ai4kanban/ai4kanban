// The production origin for the marketing site. Single source of truth — every
// canonical URL, sitemap entry, and JSON-LD `url` derives from this.
export const BASE_URL = "https://ai4kanban.dev";

// Social share card. The design lives at the `/og-image/` route (1200×630); the
// captured PNG is served from the CDN and referenced by every page's OG/Twitter
// tags. Re-capture `/og-image/` and re-upload when the card design changes.
export const OG_IMAGE = {
  url: "https://cdn.ai4kanban.dev/og-image.jpg",
  width: 4800,
  height: 2520,
  alt: "Kanban skill — your task board in Markdown, right next to your code.",
};
