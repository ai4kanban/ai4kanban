import { notFound } from "next/navigation";
import { ContactPage, PATH } from "@/components/contact/ContactPage";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";

// The contact page in Chinese, Spanish, Japanese and French.

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return pageMetadata({ locale, path: PATH, ...getCopy(locale).contact.meta });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();
  return <ContactPage locale={locale} />;
}
