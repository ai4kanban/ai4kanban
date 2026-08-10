import { notFound } from "next/navigation";
import { DownloadPage, PATH } from "@/components/pages/DownloadPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

// The download page in Chinese, Spanish, Japanese and French — /zh/download
// through /fr/download. English lives one route group over, on the unprefixed
// path.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return pageMetadata({ locale, path: PATH, ...getCopy(locale).download.meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <DownloadPage locale={locale} />;
}
