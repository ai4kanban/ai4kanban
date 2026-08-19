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
    title: "Prune the memory",
    icon: "🧹",
    tagline:
      "Keep your board's memory concise, so each planning run reads only the shipped facts, decisions, rejections, and design lessons that still matter.",
    summary:
      "A recurring maintenance task for AI4Kanban's project-wide and per-module memory. Each run rewrites the four memory files into concise topic summaries that retain only what still helps plan future work.",
    mdFile: "/recipes/prune-the-memory.md",
    installPrompt: [
      `/kanban Pull ${SITE_ORIGIN}/recipes/prune-the-memory.md`,
      "and create a recurring task from it. Keep its `## Process`",
      "unchanged and run every step.",
    ].join("\n"),
    does: [
      {
        art: "prune",
        title: "Prune project and module memory",
        body: "Rewrites the project-wide memory and each module's four memory files as concise topic summaries, keeping only shipped facts, live decisions, rejected ideas, and design lessons that still help plan future work.",
      },
    ],
  },
  {
    slug: "competitor-analysis-loop",
    title: "Competitor analysis loop",
    icon: "🔭",
    tagline:
      "Keep one feature checklist per competitor — what you already ship, what a card is building, and the gaps nobody has touched — on a per-competitor cadence.",
    summary:
      "A recurring competitor-intelligence task powered by dist0. Each run pulls the competitor mentions from your dist0 Reddit signal, rules out the false positives, and keeps one plain checklist per real competitor: every feature it offers, one line each, ticked when you already ship it, tagged with the card id when one of your cards is building it, and bare when nobody has touched it. The bare lines are your gap list, and the run files cards for the ones worth closing. Every competitor gets its own read cadence, so each pass goes to the ones that matter.",
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
        title: "Rule out the false positives",
        body: "For each product, decide: a real competitor solving the same job for the same buyer, or an unrelated one the pipeline over-matched. The ones you rule out are written down with the reason, so no later run spends time on them again.",
      },
      {
        art: "scan",
        title: "List every feature it offers",
        body: "Walks each real competitor — its site, pricing, docs, changelog, free tools, side products — and turns everything it offers users into one checkbox line per feature.",
      },
      {
        art: "study",
        title: "Keep one plain file per competitor",
        body: "The lines go into that competitor's own file, under the date it was last read and the pages they came from. Nothing else goes in it — no prose study to re-read, nothing to go quietly stale.",
      },
      {
        art: "merge",
        title: "Tie the features to your cards",
        body: "Ticks the features your users can already do today, tags the ones a card on your board is building with that card's id, and leaves the rest bare — your gap list. It files cards for the gaps worth closing and writes each new id back onto its line.",
      },
      {
        art: "cadence",
        title: "Set each competitor's cadence",
        body: "Sets how often to revisit each competitor — often for the ones shipping fast, rarely for the thin ones that grow too slowly to watch closely, never for the dead. Only due competitors get re-read, so each pass goes to the ones that matter.",
      },
    ],
  },
];

export function getRecipe(slug: string): Recipe | undefined {
  return recipes.find((r) => r.slug === slug);
}
