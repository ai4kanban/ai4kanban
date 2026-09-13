import { notFound } from "next/navigation";
import { PATH, TrainingPage } from "@/components/training/TrainingPage";
import { TRAINING_LOCALES, getTrainingCopy, isTrainingLocale } from "@/i18n/training";
import { pageMetadata } from "@/lib/metadata";

// The training page in Chinese, at /zh/training — and in nothing else.
//
// `generateStaticParams` names the one translated language the page has rather
// than every language the site has, so the export writes `/zh/training` and no
// `/es/training` for a crawler to find. English lives one route group over, on
// the unprefixed path.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TRAINING_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTrainingLocale(locale) || locale === "en") notFound();
  return pageMetadata({ locale, path: PATH, ...getTrainingCopy(locale).meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTrainingLocale(locale) || locale === "en") notFound();
  return <TrainingPage locale={locale} />;
}
