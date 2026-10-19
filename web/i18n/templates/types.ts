// The template catalog's copy (#1711). English and Chinese only, like the
// training page, so it is not part of `SiteCopy`. Category names, template
// names and descriptions come from the catalog itself, not from here.
import type { PageMeta } from "@/i18n/types";

/** A category the site knows how to name. Any other is shown as published. */
export type CategoryCopy = { name: string; title: string; back: string };

export type TemplatesCopy = {
  meta: PageMeta;
  title: string;
  lead: string;
  count: (n: number) => string;
  categories: Record<string, CategoryCopy>;
  /** The way back to a category's section the site has no name for. */
  back: (title: string) => string;
  /** The way back from a missing template. */
  all: string;
  free: string;
  pro: string;
  original: string;
  recreation: string;
  originalVideo: string;
  recreationVideo: string;
  keyframe: string;
  /** Shown on a prop or motion page: it only runs inside a video template. */
  pieceNote: string;
  play: string;
  noPreview: string;
  tags: string;
  use: string;
  useLead: string;
  download: string;
  proLead: string;
  pricing: string;
  source: string;
  site: string;
  reference: string;
  captured: string;
  originalWork: string;
  loading: string;
  unavailable: string;
  retry: string;
  empty: string;
  missing: string;
  videoFailed: string;
  openYouTube: string;
  openOriginal: string;
  /** `{title} | AI4Kanban Templates` — a template page's `<title>`. */
  detailTitle: (title: string) => string;
};
