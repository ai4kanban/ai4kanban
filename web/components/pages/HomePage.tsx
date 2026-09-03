import { Band } from "@/components/Band";
import { Header } from "@/components/Header";
import { Hero } from "@/components/home/Hero";
import { Why } from "@/components/home/Why";
import { Steps } from "@/components/home/Steps";
import { Trust } from "@/components/home/Trust";
import { Start } from "@/components/home/Start";
import { Reveal } from "@/components/home/Reveal";
import { SiteFooter } from "@/components/SiteFooter";
import { releaseBuilds } from "@/components/download/builds";
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
import { VERSION } from "@/lib/release";

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
  // The WebPage node takes the long description: the meta tag is cut at a
  // search result's width, structured data is not.
  const home = webPage("", c.meta.title, c.meta.schema, { locale });
  // The two download buttons on this page are the download page's button. They
  // hand over the file for the system the reader is on, so the release has to
  // resolve here, on the server — see `PlatformCta.tsx`.
  const systems = releaseBuilds(VERSION);

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
      {/* Two bands on a white page, and they are the page's two turns: `Why`
          takes the first so the argument for the product is not read as a
          third paragraph of the hero, and `Start` takes the last so the page
          warms on the way into the ink footer. Everything between is pictures
          and type. */}
      <main>
        <div className={column}>
          <Hero c={c.hero} locale={locale} systems={systems} />
        </div>
        <Band>
          <Why c={c.why} />
        </Band>
        <div className={column}>
          <Steps c={c.steps} />
          <Trust c={c.trust} />
        </div>
        <Band flush>
          <Start c={c.start} locale={locale} systems={systems} />
        </Band>
      </main>
      <SiteFooter c={copy} locale={locale} path="" />
    </>
  );
}
