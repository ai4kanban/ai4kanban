import type { PageMeta } from "@/i18n/types";

/** A figure's caption: its term, then one line. */
type Pair = readonly [string, string];

/** The draft-first landing page (#1635). The install command and paths are not copy. */
export type DraftFirstCopy = {
  meta: PageMeta;
  /** The WebPage node's description in the page's JSON-LD. */
  schema: string;
  hero: {
    /** Two lines; the break is the layout's. */
    title: readonly [string, string];
    lead: string;
    update: string;
    worksWith: string;
    /** The hero recording, read out loud. */
    alt: string;
  };
  drafts: { title: string; lead: string; kinds: readonly Pair[]; more: string; closing: string };
  review: { title: string; actions: readonly Pair[]; export: string };
  /** Paths in `lead` are drawn as code. */
  helpers: { title: string; lead: string; example: string; file: string; description: string; body: string };
  upgrade: { title: string; lead: string; cards: readonly Pair[]; explore: string; download: string };
  /** Paths in the answers are drawn as code. */
  faq: { title: string; items: readonly Pair[] };
};
