import { notFound } from "next/navigation";
import { SaasPage, saasMetadata } from "@/components/solutions/SaasPage";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";
import "../../../../blog-prose.css";

// /solutions/saas in the four translated languages.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return saasMetadata(locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <SaasPage locale={locale} />;
}
