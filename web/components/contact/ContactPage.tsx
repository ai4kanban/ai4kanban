import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { column, heroTop } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { PixelMark } from "@/components/ui/PixelMark";
import { getCopy } from "@/i18n";
import { localePath, publishedIn, type Locale } from "@/lib/i18n";
import { jsonLd, webPage } from "@/lib/schema";
import { ContactForm } from "./ContactForm";

export const PATH = "/contact";

// One form for support and for custom agents (#785), and a pointer to training
// where that page is published. On a phone the form comes before training.
export function ContactPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const t = copy.contact;
  const schema = jsonLd(webPage(PATH, t.meta.title, t.meta.description, { locale }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main>
        <div className={column}>
          <section
            className={`grid items-start gap-10 ${heroTop} lg:grid-cols-[1fr_1.4fr] lg:grid-rows-[auto_1fr] lg:gap-x-16`}
          >
            <div>
              <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
                {t.eyebrow}
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
                {t.title}
              </h1>
              <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted">{t.lead}</p>
            </div>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <ContactForm t={t} />
            </div>

            {publishedIn("/training", locale) && (
              <div className="rounded-2xl bg-band px-8 py-7">
                <PixelMark />
                <p className="mt-5 text-xl font-bold">{t.training.title}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{t.training.body}</p>
                <div className="mt-6">
                  <Button href={localePath(locale, "/training")}>{t.training.cta}</Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
