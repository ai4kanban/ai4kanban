import { notFound } from "next/navigation";
import { TemplatesHomePage } from "@/components/templates/TemplatesPage";
import { TEMPLATES_LOCALES, getTemplatesCopy, isTemplatesLocale } from "@/i18n/templates";
import { pageMetadata } from "@/lib/metadata";
import { TEMPLATES_PATH, buildCatalog } from "@/lib/templates";

// The template catalog in Chinese, at /zh/templates, and in no other language.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TEMPLATES_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTemplatesLocale(locale) || locale === "en") notFound();
  return pageMetadata({ locale, path: TEMPLATES_PATH, ...getTemplatesCopy(locale).meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTemplatesLocale(locale) || locale === "en") notFound();
  return <TemplatesHomePage locale={locale} initial={await buildCatalog()} />;
}
