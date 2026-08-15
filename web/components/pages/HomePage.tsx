import { Band } from "@/components/Band";
import { Header } from "@/components/Header";
import { Hero } from "@/components/home/Hero";
import { Compare } from "@/components/home/Compare";
import { Loop } from "@/components/home/Loop";
import { Memory } from "@/components/home/Memory";
import { Iterate } from "@/components/home/Iterate";
import { Start } from "@/components/home/Start";
import { Reveal } from "@/components/home/Reveal";
import { SiteFooter } from "@/components/SiteFooter";
import { column } from "@/components/styles";
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
//
// The chrome is the site's: `Header.tsx` on top and `SiteFooter.tsx` under,
// the same pair the comparison pages carry.
//
// `Reveal` is the page's motion, and it draws nothing: it ships the rules that
// hold a block back and the one observer that lets it go, and the sections
// below opt in with `data-reveal` / `data-enter`. It is mounted once here
// because those rules are document-wide — see the header comment in that file.
export function HomePage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const c = copy.home;
  const home = webPage("", c.meta.title, c.meta.description, { locale });

  const schema = jsonLd(home, {
    ...softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      description: c.meta.description,
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
      <Reveal />
      <Header c={copy} locale={locale} />
      {/* Two bands on a white page. `Compare` needs one — it says which column
          wins with the neutral ramp, and on white its paper card has nothing to
          be brighter than. `Start` takes the other so the page warms on the way
          into the ink footer. Everything between is pictures and type. */}
      <main>
        <div className={column}>
          <Hero c={c.hero} locale={locale} />
        </div>
        <Band>
          <Compare c={c.compare} />
        </Band>
        <div className={column}>
          <Loop c={c.loop} />
          <Memory c={c.memory} />
          <Iterate c={c.iterate} />
        </div>
        <Band flush>
          <Start c={c.start} locale={locale} />
        </Band>
      </main>
      <SiteFooter c={copy} locale={locale} path="" />
    </>
  );
}
