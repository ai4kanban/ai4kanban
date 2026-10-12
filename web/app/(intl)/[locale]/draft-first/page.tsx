import { notFound } from "next/navigation";
import { DraftFirstPage, draftFirstMetadata } from "@/components/draft-first/DraftFirstPage";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

// /draft-first in the four translated languages.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return draftFirstMetadata(locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <DraftFirstPage locale={locale} />;
}
