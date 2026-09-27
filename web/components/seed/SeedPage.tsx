import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { column } from "@/components/styles";
import { getCopy } from "@/i18n";
import { getPricingCopy, type PricingLocale } from "@/i18n/pricing";
import { getSeedCopy } from "@/i18n/seed";
import { jsonLd, webPage } from "@/lib/schema";
import { SeedArt } from "./SeedArt";
import { SeedForm } from "./SeedForm";

export const PATH = "/seed";

// The seed partner application (#1039), linked from the pricing page and
// published in its languages. On a wide screen, two equal halves about a
// screen tall; on a phone, the pitch and then the form.
export function SeedPage({ locale }: { locale: PricingLocale }) {
  const copy = getCopy(locale);
  const t = getSeedCopy(locale);
  const schema = jsonLd(webPage(PATH, t.meta.title, t.meta.description, { locale }));
  const half = "lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-14";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main>
        <div className={column}>
          <section className="mt-10 mb-16 grid items-start gap-10 lg:my-8 lg:min-h-[calc(100vh-128px)] lg:grid-cols-2 lg:items-stretch lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/15">
            <div className={`${half} lg:bg-band`}>
              <h1 className="text-4xl font-bold leading-[1.15] tracking-tight lg:text-[3.5rem]">{t.title}</h1>
              <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted">
                {getPricingCopy(locale).seed.body}
              </p>
              <SeedArt />
            </div>
            <div className={half}>
              <SeedForm t={t} />
            </div>
          </section>
        </div>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
