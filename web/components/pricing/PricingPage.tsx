import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { heroTop } from "@/components/styles";
import { getCopy } from "@/i18n";
import { getPricingCopy, type PricingLocale } from "@/i18n/pricing";
import { localePath } from "@/lib/i18n";
import { jsonLd, webPage } from "@/lib/schema";
import { Plans } from "./Plans";

export const PATH = "/pricing";

// Published in English and Chinese only (`PATH_LOCALES` in `lib/i18n.ts`).
export function PricingPage({ locale }: { locale: PricingLocale }) {
  const copy = getCopy(locale);
  const t = getPricingCopy(locale);
  const schema = jsonLd(webPage(PATH, t.meta.title, t.meta.description, { locale }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main className="mx-auto max-w-5xl px-6 pb-20">
        <section className={`${heroTop} text-center`}>
          <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
            {t.hero.eyebrow}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight lg:text-[3.5rem]">
            {t.hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-muted">
            {t.hero.lead}
          </p>
        </section>
        <Plans
          t={t}
          links={{
            download: localePath(locale, "/download"),
            contact: localePath(locale, "/contact"),
            training: localePath(locale, "/training"),
          }}
        />
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
