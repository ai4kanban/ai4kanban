import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { column } from "@/components/styles";
import { getCopy } from "@/i18n";
import { getTrainingCopy, type TrainingLocale } from "@/i18n/training";
import { ORG_ID, jsonLd, pageUrl, webPage } from "@/lib/schema";
import { Booking } from "./Booking";
import { Guidance, Hero, Outcome, Stuck, Tiers } from "./Sections";

export const PATH = "/training";

// Hands-on guidance around a reader's own project, with the week they can book
// an hour in (#683).
//
// Published in English and Chinese only — it is a service sold in two languages,
// not a page waiting on three translations. `PATH_LOCALES` in `lib/i18n.ts` is
// what carries that: the routes, the nav links, the hreflang set, the sitemap and
// both language switchers all read it, so there is one place to change if a
// third language is ever added.
//
// The page is static except for `Booking`. Everything a reader decides on — what
// this is, what it covers, what it costs — is server-rendered and in the HTML;
// only the week itself waits on the browser, because only the browser knows what
// day it is where the reader is.

export function TrainingPage({ locale }: { locale: TrainingLocale }) {
  const copy = getCopy(locale);
  const t = getTrainingCopy(locale);

  // A `Service` beside the page node: this is the one page on the site that
  // offers something for money, and the offers are the two prices it prints.
  const page = webPage(PATH, t.meta.title, t.meta.description, { locale });
  const schema = jsonLd(page, {
    "@type": "Service",
    "@id": `${pageUrl(PATH, locale)}#service`,
    name: t.hero.title,
    description: t.hero.lead,
    serviceType: t.tiers.heading.title,
    provider: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": page["@id"] },
    offers: [t.tiers.single, t.tiers.monthly].map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price.replace(/[^\d.]/g, ""),
      priceCurrency: "USD",
      description: tier.body,
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main>
        <div className={column}>
          <Hero t={t} />
          <Stuck t={t} />
          <Outcome t={t} />
          <Guidance t={t} />
          <Tiers t={t} />
          <Booking t={t} locale={locale} />
        </div>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
