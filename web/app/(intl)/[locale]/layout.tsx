import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCopy } from "@/i18n";
import { htmlLang, pageMetadata, siteIcons } from "@/lib/metadata";
import { BASE_URL } from "@/lib/site";
import { TRANSLATED_LOCALES, isTranslatedLocale } from "@/lib/i18n";
import "../../globals.css";

// The second root layout: one <html lang="…"> per translated language. English
// has its own in `(en)/layout.tsx` because it stays on the unprefixed paths.

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

  return {
    metadataBase: new URL(BASE_URL),
    ...pageMetadata({ locale, path: "", ...getCopy(locale).home.meta }),
    ...siteIcons,
  };
}

export default async function IntlRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isTranslatedLocale(locale)) notFound();

  return (
    <html lang={htmlLang(locale)}>
      <head>
        {/* Same domain shepherding as the English layout — see (en)/layout.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(location.hostname.endsWith(".pages.dev")||location.hostname.endsWith("kanbanskill.cc")){location.replace("https://ai4kanban.dev"+location.pathname+location.search+location.hash)}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
