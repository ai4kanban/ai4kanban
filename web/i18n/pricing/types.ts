// The pricing page's copy. English and Chinese only, like `i18n/training`.
import type { PageMeta } from "@/i18n/types";

/** A plan row; one with `more` folds its details behind a chevron, `cue` labelling it. */
export type PlanRow = string | { text: string; cue?: string; more: { note?: string; list?: string[]; table?: [string, string][] } };

export type PricingCopy = {
  meta: PageMeta;
  hero: { eyebrow: string; title: string; lead: string };
  billing: { monthly: string; yearly: string; save: string };
  free: { name: string; price: string; tagline: string; rows: PlanRow[]; button: string };
  pro: {
    name: string;
    yearly: { price: string; per: string; sub: string };
    monthly: { price: string; per: string };
    leadIn: string;
    rows: PlanRow[];
    button: string;
  };
  seed: { name: string; body: string; button: string };
  custom: { name: string; price: string; per: string; body: string; button: string };
  training: { name: string; button: string };
};
