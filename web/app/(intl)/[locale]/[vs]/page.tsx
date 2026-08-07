import { notFound } from "next/navigation";
import {
  comparisonMetadata,
  comparisonSlugs,
  findComparison,
} from "@/lib/comparisons";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

// The same comparison pages in the four translated languages —
// /zh/vs-github-issues through /fr/vs-multica. English lives one route group
// over, at `app/(en)/[vs]/page.tsx`, on the unprefixed paths.

type Props = { params: Promise<{ locale: string; vs: string }> };

export function generateStaticParams() {
  return TRANSLATED_LOCALES.flatMap((locale) =>
    comparisonSlugs().map((vs) => ({ locale, vs })),
  );
}

/** The page a `/{locale}/{vs}` pair names — a 404 if either half isn't ours. */
async function resolve(params: Props["params"]) {
  const { locale, vs } = await params;
  const comparison = findComparison(vs);
  if (!isTranslatedLocale(locale) || !comparison) notFound();
  return { locale, comparison };
}

export async function generateMetadata({ params }: Props) {
  const { locale, comparison } = await resolve(params);
  return comparisonMetadata(comparison, locale);
}

export default async function Page({ params }: Props) {
  const { locale, comparison } = await resolve(params);
  return <comparison.Page locale={locale} />;
}
