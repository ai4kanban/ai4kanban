import { notFound } from "next/navigation";
import { PATH, SeedPage } from "@/components/seed/SeedPage";
import { PRICING_LOCALES, isPricingLocale } from "@/i18n/pricing";
import { getSeedCopy } from "@/i18n/seed";
import { pageMetadata } from "@/lib/metadata";

// The seed partner page in Chinese, at /zh/seed — the pricing page's languages and no others.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return PRICING_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isPricingLocale(locale) || locale === "en") notFound();
  return pageMetadata({ locale, path: PATH, ...getSeedCopy(locale).meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isPricingLocale(locale) || locale === "en") notFound();
  return <SeedPage locale={locale} />;
}
