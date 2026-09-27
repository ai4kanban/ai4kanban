// The pricing page's copy. English and Chinese only, like `i18n/training`.
import type { PageMeta } from "@/i18n/types";

export type Workflow = "coding" | "email" | "slides" | "video";

export type PricingCopy = {
  meta: PageMeta;
  hero: { eyebrow: string; title: string; lead: string };
  billing: { monthly: string; yearly: string; save: string };
  free: { name: string; price: string; tagline: string; rows: string[]; button: string };
  pro: {
    name: string;
    yearly: { price: string; per: string; sub: string };
    monthly: { price: string; per: string };
    leadIn: string;
    rows: string[];
    button: string;
  };
  /** The decorative board behind the plans: workflow tag labels and sample task names. */
  board: { tags: Record<Workflow, string>; tasks: Record<Workflow, string[]> };
  seed: { name: string; body: string; button: string };
  training: { name: string; button: string };
};
