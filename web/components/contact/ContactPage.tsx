import { FiArrowRight } from "react-icons/fi";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { column, hairline, heroTop } from "@/components/styles";
import { PixelMark } from "@/components/ui/PixelMark";
import { getCopy } from "@/i18n";
import { localePath, publishedIn, type Locale } from "@/lib/i18n";
import { jsonLd, webPage } from "@/lib/schema";
import { ContactForm } from "./ContactForm";
import { SignalField } from "./SignalField";

export const PATH = "/contact";

// One form for support and for custom agents (#785): pick on the left, write on
// the right (#1288). On a phone: heading, reasons, form, training.
export function ContactPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const t = copy.contact;
  const schema = jsonLd(webPage(PATH, t.meta.title, t.meta.description, { locale }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main className="relative isolate flow-root">
        <SignalField />
        <div className={column}>
          <section
            className={`grid items-start gap-8 ${heroTop} lg:grid-cols-[1fr_1.15fr] lg:grid-rows-[auto_auto_1fr] lg:gap-x-20 lg:gap-y-0`}
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
                {t.eyebrow}
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
                {t.title}
              </h1>
              <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-muted">{t.lead}</p>
            </div>

            <ContactForm t={t} />

            {publishedIn("/training", locale) && (
              <div
                className={`flex items-center gap-4 border-t pt-6 lg:col-start-1 lg:row-start-3 lg:mt-10 ${hairline}`}
              >
                <PixelMark className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.training.title}</p>
                  <p className="text-sm text-muted">{t.training.body}</p>
                </div>
                <a
                  href={localePath(locale, "/training")}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-accent-deep no-underline hover:underline hover:underline-offset-4"
                >
                  {t.training.cta}
                  <FiArrowRight aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
