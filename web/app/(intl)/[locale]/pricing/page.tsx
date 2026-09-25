import { notFound } from "next/navigation";
import { PATH, PricingPage } from "@/components/pricing/PricingPage";
import { PRICING_LOCALES, getPricingCopy, isPricingLocale } from "@/i18n/pricing";
import { pageMetadata } from "@/lib/metadata";

// The pricing page in Chinese, at /zh/pricing — and in nothing else.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return PRICING_LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isPricingLocale(locale) || locale === "en") notFound();
  return pageMetadata({ locale, path: PATH, ...getPricingCopy(locale).meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isPricingLocale(locale) || locale === "en") notFound();
  return <PricingPage locale={locale} />;
}
