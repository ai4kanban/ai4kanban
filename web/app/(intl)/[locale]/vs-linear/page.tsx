import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PATH, VsLinearPage } from "@/components/pages/VsLinearPage";
import { getCopy } from "@/i18n";
import {
  TRANSLATED_LOCALES,
  isTranslatedLocale,
} from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

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
    ...getCopy(locale).vsLinear.meta,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <VsLinearPage locale={locale} />;
}
