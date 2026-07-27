import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PATH, VsHermesPage } from "@/components/pages/VsHermesPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return pageMetadata({
    locale,
    path: PATH,
    type: "article",
    ...getCopy(locale).vsHermes.meta,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <VsHermesPage locale={locale} />;
}
