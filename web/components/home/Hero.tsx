import { GITHUB_URL } from "../content";
import { Rich } from "../Rich";
import { Quickview } from "./Quickview";
import type { HomeCopy } from "@/i18n/types";
import { localeHref, type Locale } from "@/lib/i18n";

export function Hero({ c, locale }: { c: HomeCopy; locale: Locale }) {
  return (
    <>
      <section className="mt-12 text-center">
        <p className="mb-5 inline-block rounded-full bg-accent/10 px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-accent">
          {c.hero.badge}
        </p>
        <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          <Rich>{c.hero.title}</Rich>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          <Rich>{c.hero.lead}</Rich>
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={localeHref(locale, "/#install")}
            className="rounded-lg border-2 border-accent bg-accent px-6 py-3 font-semibold text-white no-underline shadow-[4px_4px_0_0_#1f6feb] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1f6feb]"
          >
            {c.hero.ctaInstall}
          </a>
          <a
            href={GITHUB_URL}
            rel="noopener"
            className="rounded-lg border-2 border-border px-6 py-3 font-semibold text-ink no-underline shadow-[4px_4px_0_0_#010409] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[6px_6px_0_0_var(--color-accent)]"
          >
            {c.hero.ctaGithub}
          </a>
        </div>
      </section>

      <section className="mt-16">
        <Quickview c={c.quickview} />
      </section>
    </>
  );
}
