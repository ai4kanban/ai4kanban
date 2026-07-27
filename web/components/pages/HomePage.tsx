import { Header } from "@/components/Header";
import { Hero } from "@/components/home/Hero";
import { Features } from "@/components/home/Features";
import { Install } from "@/components/home/Install";
import { BoardTable } from "@/components/home/BoardTable";
import { BoardUI } from "@/components/home/BoardUI";
import { Presets } from "@/components/home/Presets";
import { Advanced } from "@/components/home/Advanced";
import { Footer } from "@/components/Footer";
import { getCopy } from "@/i18n";
import {
  APP_ID,
  ORG_ID,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";
import type { Locale } from "@/lib/i18n";

// The landing page, rendered once per language. `app/(en)/page.tsx` builds the
// English copy at `/`; `app/(intl)/[locale]/page.tsx` builds the other four.
export function HomePage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const home = webPage("", c.home.meta.title, c.home.meta.description, {
    locale,
  });

  const schema = jsonLd(home, {
    ...softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      description: c.home.meta.description,
      url: pageUrl(""),
      free: true,
    }),
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": home["@id"] },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale={locale} />
      <main className="mx-auto max-w-4xl px-6">
        <Hero c={c.home} locale={locale} />
        <Features c={c.home} />
        <Install c={c} />
        <BoardTable c={c.home} />
        <BoardUI c={c} />
        <Presets c={c.home} />
        <Advanced c={c.home} />
      </main>
      <Footer c={c} locale={locale} path="" />
    </>
  );
}
