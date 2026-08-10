// The shape of the site's copy: the pieces every page reuses, and `SiteCopy`,
// which joins one folder's type per page. Each page's own shape lives beside
// its words — `home/types.ts`, `vs-linear/types.ts`, and so on.
//
// Every language declares these same types, so a key English adds and a
// language hasn't translated yet is a build error rather than a silently
// missing sentence.
//
// Only *words* live in `i18n/`. Structure that isn't language — emoji, which
// side wins a comparison row, a track's colour — stays in the component modules
// and is joined to this copy by key.
import type { SharedCopy } from "./shared/types";
import type { HomeCopy } from "./home/types";
import type { DownloadCopy } from "./download/types";
import type { VsGithubCopy } from "./vs-github-issues/types";
import type { VsHermesCopy } from "./vs-hermes-kanban/types";
import type { VsVibeCopy } from "./vs-vibe-kanban/types";
import type { VsLinearCopy } from "./vs-linear/types";
import type { VsMulticaCopy } from "./vs-multica/types";
import type { VsTaskMasterCopy } from "./vs-task-master/types";

/** Page `<title>` / description, plus the share-card variants when they differ. */
export type PageMeta = {
  title: string;
  description: string;
  /** Share-card title, when the full one is too long. Defaults to `title`. */
  socialTitle?: string;
  /** Share-card description. Defaults to `description`. */
  social?: string;
};

/** A numbered section's eyebrow + H2. The number itself isn't copy. */
export type Heading = { eyebrow: string; title: string };

export type TitleBody = { title: string; body: string };

/** The two-chip header every comparison page opens with. */
export type VsHero = {
  badge: string;
  /** `\n` marks the line break in the H1. */
  title: string;
  lead: string;
  ours: { name: string; body: string };
  theirs: { name: string; body: string };
};

/**
 * The words a hero diagram pair needs. The captions are the argument in one
 * line each — above the art, what the product is; below it, what it costs you —
 * so they are copy, while everything inside the drawings (product names, file
 * names, marks) stays with the component and isn't translated.
 */
export type VsHeroDiagrams = {
  oursDiagramAlt: string;
  theirsDiagramAlt: string;
  oursDiagramTop: string;
  oursDiagramBottom: string;
  theirsDiagramTop: string;
  theirsDiagramBottom: string;
};

/** The closing "which should you use?" section. */
export type VsDecision = {
  heading: Heading;
  oursHeading: string;
  theirsHeading: string;
  ours: string[];
  theirs: string[];
  verdict: string;
  note: string;
};

/** Every word the site renders, in one language. */
export type SiteCopy = {
  shared: SharedCopy;
  home: HomeCopy;
  download: DownloadCopy;
  vsGithub: VsGithubCopy;
  vsHermes: VsHermesCopy;
  vsVibe: VsVibeCopy;
  vsLinear: VsLinearCopy;
  vsMultica: VsMulticaCopy;
  vsTaskMaster: VsTaskMasterCopy;
};
