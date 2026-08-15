// The production origin for the marketing site. Single source of truth — every
// canonical URL, sitemap entry, and JSON-LD `url` derives from this.
export const BASE_URL = "https://ai4kanban.dev";

// The site's large images — the watercolour mats, the hero banner, the share
// card — live in the `kanbanskill` R2 bucket behind this origin rather than in
// `public/`, so a Pages deploy doesn't re-upload a megabyte of artwork it never
// changed. Every name carries a version suffix and is served `immutable`, so
// replacing an asset means uploading a new name — never overwriting one.
export const CDN = "https://cdn.ai4kanban.dev";

// Social share card. The design lives at the `/og-image/` route (1200×630); the
// captured PNG is served from the CDN and referenced by every page's OG/Twitter
// tags. Re-capture `/og-image/` and re-upload when the card design changes.
export const OG_IMAGE = {
  url: `${CDN}/og-image-v5.jpg`,
  width: 4800,
  height: 2520,
  alt: "AI4Kanban — a project board that plans itself.",
};
