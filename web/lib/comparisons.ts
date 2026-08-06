// The four comparison pages, in one list.
//
// Each renders at two URL shapes — `/vs-x` for English and `/{locale}/vs-x` for
// the four translations — and Next needs a route file per shape, because only a
// root layout can render `<html lang>`. The translations collapse into one
// dynamic route, `app/(intl)/[locale]/[vs]/page.tsx`. English cannot: its slug
// sits at the root level, where `[locale]` already is, and Next allows one slug
// name per level. So `app/(en)/vs-x/page.tsx` stays a directory each — but a
// three-line one, with the copy key and the `<head>` coming from here.
import type { Metadata } from "next";
import { PATH as githubPath, VsGithubPage } from "@/components/pages/VsGithubPage";
import { PATH as hermesPath, VsHermesPage } from "@/components/pages/VsHermesPage";
import { PATH as vibePath, VsVibePage } from "@/components/pages/VsVibePage";
import { PATH as linearPath, VsLinearPage } from "@/components/pages/VsLinearPage";
import { getCopy } from "@/i18n";
import type { SiteCopy } from "@/i18n/types";
import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

/** The `SiteCopy` keys holding a comparison page's words. */
type VsCopyKey = Extract<keyof SiteCopy, `vs${string}`>;

export type Comparison = {
  /** Route path, e.g. "/vs-github-issues". */
  path: string;
  /** Where this page's words live in `SiteCopy`. */
  copy: VsCopyKey;
  Page: (props: { locale: Locale }) => React.ReactElement;
};

export const COMPARISONS: readonly Comparison[] = [
  { path: githubPath, copy: "vsGithub", Page: VsGithubPage },
  { path: hermesPath, copy: "vsHermes", Page: VsHermesPage },
  { path: vibePath, copy: "vsVibe", Page: VsVibePage },
  { path: linearPath, copy: "vsLinear", Page: VsLinearPage },
];

/** The `[vs]` segment of each comparison route — "vs-github-issues", and so on. */
export function comparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.path.slice(1));
}

/** The comparison a `[vs]` segment names, or `undefined` for anything else. */
export function findComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.path === `/${slug}`);
}

/** A comparison's `<head>` in one language. */
export function comparisonMetadata(c: Comparison, locale: Locale): Metadata {
  return pageMetadata({
    locale,
    path: c.path,
    type: "article",
    ...getCopy(locale)[c.copy].meta,
  });
}

/** The English `<head>` for a comparison route, by path — what `app/(en)/vs-*` exports. */
export function englishMetadata(path: string): Metadata {
  const comparison = findComparison(path.slice(1));
  if (!comparison) throw new Error(`No comparison at ${path}`);
  return comparisonMetadata(comparison, "en");
}
