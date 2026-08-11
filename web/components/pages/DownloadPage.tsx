import { FiDownload, FiGithub } from "react-icons/fi";
import { Header } from "@/components/Header";
import { Rich } from "@/components/Rich";
import { SectionHeading } from "@/components/SectionHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/Button";
import { panelInset, panelStatic, framed, heroTop } from "@/components/styles";
import { getCopy } from "@/i18n";
import type { Locale } from "@/lib/i18n";
import { APP_ID, ORG_ID, jsonLd, pageUrl, softwareApplication, webPage } from "@/lib/schema";

export const PATH = "/download";

// Where a person gets the board as an app — one page, in every language, that
// the READMEs, the skill, the CLI and the board's own deprecation notice all
// point at. Whatever it says has to hold for someone who has never opened a
// terminal, so it is four short sections: get it, which build, past the warning,
// and what happens next.
//
// The builds themselves are not copy (design.md §6): which system takes which
// file, and whether it is signed or tested, is a fact about the release, so it
// lives here and the language files carry only the words around it. The system
// names come from the copy so they can be written in the reader's own language.

/** The release the download button goes to. GitHub redirects `/latest` to the
 *  newest tag, so this link never has to be bumped. */
const RELEASES_URL = "https://github.com/ai4kanban/ai4kanban/releases/latest";

/** One row of the builds table, in the order it is listed. `system` is an index
 *  into the copy's own list, so the name is translated and the rest isn't. */
const BUILDS = [
  { file: ".dmg / .zip", signed: false, tested: true },
  { file: ".exe", signed: false, tested: false },
  { file: ".AppImage", signed: false, tested: false },
] as const;

export function DownloadPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const t = copy.download;
  const page = webPage(PATH, t.meta.title, t.meta.description, { locale });

  const schema = jsonLd(page, {
    ...softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      description: t.meta.description,
      url: pageUrl(PATH),
      free: true,
    }),
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": page["@id"] },
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main className="mx-auto max-w-5xl px-6">
        <section className={heroTop}>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t.hero.title}
          </h1>
          <p className="mt-6 max-w-3xl text-[1.05rem] leading-relaxed text-muted">
            {t.hero.lead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button href={RELEASES_URL} variant="primary">
              <FiDownload className="h-4 w-4" aria-hidden="true" />
              {t.hero.cta}
            </Button>
            <Button href={RELEASES_URL} variant="secondary">
              <FiGithub className="h-4 w-4" aria-hidden="true" />
              GitHub Releases
            </Button>
          </div>
          <p className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-muted">
            {t.hero.note}
          </p>
        </section>

        <section className="mt-24">
          <SectionHeading num="01" eyebrow="Builds" title={t.builds.title} />
          <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">{t.builds.lead}</p>
          {/* One set of lines, not two: the panel is the object and the rules
              between its rows are the only edges on it (design.md §3). */}
          <div className={`${panelStatic} ${framed} mt-7 overflow-x-auto`}>
            <table className="w-full min-w-[32rem] border-collapse text-left text-[0.95rem]">
              <thead>
                <tr className="border-b-2 border-border">
                  <Th>{t.builds.columns.system}</Th>
                  <Th>{t.builds.columns.file}</Th>
                  <Th>{t.builds.columns.signed}</Th>
                  <Th>{t.builds.columns.tested}</Th>
                </tr>
              </thead>
              <tbody>
                {BUILDS.map((build, i) => (
                  <tr key={build.file} className={i > 0 ? "border-t border-border/20" : undefined}>
                    <Td className="font-semibold text-ink">{t.builds.systems[i]}</Td>
                    <Td className="font-mono text-[0.9rem]">{build.file}</Td>
                    <Td>{build.signed ? t.builds.yes : t.builds.no}</Td>
                    <Td>{build.tested ? t.builds.yes : t.builds.no}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-24">
          <SectionHeading num="02" eyebrow="First open" title={t.unsigned.title} />
          <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
            {t.unsigned.lead}
          </p>
          {/* macOS takes four clicks where the other two take one, so it gets
              the full width and a numbered list — the count is the point. */}
          <div className={`${panelInset} mt-7 p-6`}>
            <h3 className="text-lg font-bold">{t.unsigned.mac.title}</h3>
            <ol className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed text-muted">
              {t.unsigned.mac.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[0.8rem] font-semibold text-accent-deep">
                    {i + 1}
                  </span>
                  <span>
                    <Rich code="wash">{step}</Rich>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {[t.unsigned.windows, t.unsigned.linux].map((step) => (
              <div key={step.title} className={`${panelInset} p-6`}>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                  <Rich code="wash">{step.body}</Rich>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24">
          <SectionHeading num="03" eyebrow="After" title={t.using.title} />
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            {t.using.items.map((item) => (
              <div key={item.title} className={`${panelStatic} p-6`}>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The old way, said once and plainly. It sinks to the wash because the
            ramp is how the page says which of two blocks is the answer. */}
        <section className="mt-24 mb-8">
          <div className={`${panelInset} p-7`}>
            <h2 className="text-xl font-bold">{t.deprecated.title}</h2>
            <p className="mt-3 max-w-3xl text-[0.95rem] leading-relaxed text-muted">
              <Rich code="wash">{t.deprecated.body}</Rich>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 text-muted ${className}`}>{children}</td>;
}
