import { notFound } from "next/navigation";
import { HomePage } from "@/components/pages/HomePage";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

// The landing page in Chinese, Spanish, Japanese, and French — /zh, /es, /ja,
// /fr. The English original stays at "/". Metadata comes from the layout, which
// is where Next reads it for a segment's own index page.
export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <HomePage locale={locale} />;
}
