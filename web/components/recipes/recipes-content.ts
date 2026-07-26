// The recipes catalog. A recipe is a ready-made recurring task — a job you run on
// a cadence that never archives; each pass is a run, and the card sharpens over
// time until it needs no human (see ai4kanban's recurring-task guide).
// For now every recipe is a recurring task; other kinds may come later.
import { BASE_URL } from "@/lib/site";

// Production origin, used to build the copy-paste install prompt with a real URL.
export const SITE_ORIGIN = BASE_URL;

// One key step of the task, shown as a card and folded into the HowTo schema.
// `art` names the SVG glyph drawn for it (see RecipeStepIcon in RecipeLanding).
export type RecipeStep = { art: string; title: string; body: string };

// A brand-affiliated recipe leans on an outside product to run — you need that
// product's account/API key, not just ai4kanban. When set, the card and
// landing page carry the brand's logo and a "requires <brand>" note so the
// dependency is obvious before anyone tries to run it.
export type RecipeBrand = {
  name: string; // "dist0"
  logo: string; // public path to the brand mark
  url: string; // the brand's homepage
  requires: string; // one line naming exactly what you need (account, API key…)
};

export type Recipe = {
  slug: string;
  title: string;
  icon: string;
  tagline: string; // one-liner for the index card
  summary: string; // hero paragraph on the recipe page
  mdFile: string; // public path to the downloadable card
  installPrompt: string; // the /kanban prompt that pulls it in
  does: RecipeStep[]; // the key steps of one run
  brand?: RecipeBrand; // set when the recipe depends on an outside product
};

export const recipes: Recipe[] = [
  {
    slug: "daily-kanban-maintenance",
    title: "Daily kanban maintenance",
    icon: "🧹",
    tagline:
      "Daily cleanup for your kanban board — it proposes new work, prunes stale cards, and keeps priorities short, so the board stays sharp on its own.",
    summary:
      "A recurring upkeep task for a markdown kanban board — you run it on a cadence and each pass keeps the board tidy and sharp instead of letting it pile up. Built for solo developers who run their board through Claude Code.",
    mdFile: "/recipes/daily-kanban-maintenance.md",
    installPrompt: [
      `/kanban Pull ${SITE_ORIGIN}/recipes/daily-kanban-maintenance.md`,
      "and create a recurring task for it. Run every step in its",
      "`## Process`, including the cron re-arm at the end.",
    ].join("\n"),
    does: [
      {
        art: "orient",
        title: "See what changed",
        body: "Looks at your board and what you've touched in your git repo since last time, so it only reviews the new stuff — not everything from scratch.",
      },
      {
        art: "propose",
        title: "Suggest new tasks",
        body: "Spots gaps worth working on and adds a few new cards — only ones that pass a quick quality check, so the board doesn't fill up with noise.",
      },
      {
        art: "prune",
        title: "Tidy the board's memory",
        body: "Compresses the board's memory — what's done, what got dropped, what to remember — and clears out stale, long-idle cards, so the board stays short and useful instead of piling up.",
      },
      {
        art: "cap",
        title: "Keep the priority list short",
        body: "Sorts your high-priority cards and keeps only the top 6. The rest are nudged down to medium (never deleted), so you always know what matters most.",
      },
      {
        art: "advance",
        title: "Push top cards forward",
        body: "Takes your most important cards and refines each one a step more concrete — turning a fuzzy idea into a clearer, more actionable plan.",
      },
      {
        art: "questions",
        title: "Raise questions for human input",
        body: "If something needs a decision from you, it writes the question down instead of stopping. You answer whenever you like, and the next run picks it up.",
      },
    ],
  },
  {
    slug: "competitor-analysis-loop",
    title: "Competitor analysis loop",
    icon: "🔭",
    tagline:
      "Pull the competitors people name in your dist0 Reddit signal, study each real one deeply, and turn what you find into cards — on a per-competitor cadence.",
    summary:
      "A recurring competitor-intelligence task powered by dist0. Each run pulls the competitor mentions from your dist0 Reddit signal, filters the false positives out at the source, studies each real competitor deeply — features, offerings, SEO content assets — and files the build/grow/offer ideas as kanban cards. Every competitor gets its own study cadence, so the loop gets sharper each pass.",
    mdFile: "/recipes/competitor-analysis-loop.md",
    installPrompt: [
      `/kanban Pull ${SITE_ORIGIN}/recipes/competitor-analysis-loop.md`,
      "and create a recurring task for it. Run every step in its",
      "`## Process`. Requires a dist0 account and DIST0_API_KEY.",
    ].join("\n"),
    brand: {
      name: "dist0",
      logo: "/recipes/brand/dist0.png",
      url: "https://www.dist0.com",
      requires: "a dist0 account and a DIST0_API_KEY",
    },
    does: [
      {
        art: "pull",
        title: "Pull competitor mentions",
        body: "Calls dist0's competitors.list — the competitor mentions in your dist0 Reddit signal (one of its signal types), ranked by how often people named each product. That mention feed is the whole starting point.",
      },
      {
        art: "triage",
        title: "Filter out false positives",
        body: "For each product, decide: a real competitor solving the same job for the same buyer, or an unrelated one the pipeline over-matched. It automatically pushes that judgment back through dist0, so its competitor detection sharpens to your preference and stops surfacing the ones you've ruled out.",
      },
      {
        art: "scan",
        title: "Study each real competitor",
        body: "Writes a doc per competitor, examining its features, offerings, and SEO content assets — then identifies where your own product falls short and files kanban cards with concrete ideas for closing those gaps.",
      },
      {
        art: "cadence",
        title: "Set each competitor's cadence",
        body: "Sets how often to revisit each competitor — frequently for the mature, serious ones, rarely for the thin or immature that develop too slowly to be worth close watching, never for the dead. Only due competitors get re-studied, so each pass goes to the ones that matter.",
      },
    ],
  },
];

export function getRecipe(slug: string): Recipe | undefined {
  return recipes.find((r) => r.slug === slug);
}
