import { FiDownload } from "react-icons/fi";
import { Band } from "@/components/Band";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { IconChip } from "@/components/ui/IconChip";
import { DownloadHero } from "@/components/download/DownloadHero";
import { PlatformGuide } from "@/components/download/PlatformGuide";
import { releaseBuilds } from "@/components/download/builds";
import { SYSTEM_ICON } from "@/components/download/icons";
import { column, heroTop, panelStatic } from "@/components/styles";
import { getCopy } from "@/i18n";
import type { Locale } from "@/lib/i18n";
import { RELEASES_URL, VERSION } from "@/lib/release";
import { APP_ID, ORG_ID, jsonLd, pageUrl, softwareApplication, webPage } from "@/lib/schema";

export const PATH = "/download";

// Where a person gets the board as an app — one page, in every language, that
// the READMEs, the skill, the CLI and the board's own deprecation notice all
// point at.
//
// It is a utility page and it is kept to what a reader came for: one button
// aimed at the system they are on, a column per system holding every file, and
// the version of the release all of it points into. Everything the app tells
// you itself once it is open — how it picks a project, how it handles updates —
// stayed off it. The one section past the downloads covers first launch.
//
// The retired `npx ai4kanban-ui` way is not mentioned, here or anywhere else on
// the site: naming it is how a reader finds out it exists, and the page whose
// job is to hand out the app is the last place to teach the way we dropped. It
// stays alive for the people already on it — the npm package prints its own
// notice, and so does the board it serves.
//
// None of the release is copy (design.md §6): the version, the file names and
// the system names live in `lib/release.ts` and `components/download/builds.ts`,
// and the language files carry only the words around them.

export function DownloadPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const t = copy.download;
  const page = webPage(PATH, t.meta.title, t.meta.description, { locale });
  const systems = releaseBuilds(VERSION);

  const schema = jsonLd(page, {
    ...softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      description: t.meta.description,
      url: pageUrl(PATH),
      free: true,
    }),
    softwareVersion: VERSION,
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@id": page["@id"] },
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={copy} locale={locale} />
      <main>
        <div className={column}>
          <section className={heroTop}>
            <DownloadHero
              systems={systems}
              version={VERSION}
              title={t.hero.title}
              lead={t.hero.lead}
              cta={t.hero.cta}
              ctaFor={t.hero.ctaFor}
              fallback={RELEASES_URL}
            />
          </section>

          {/* Every file the release holds, a card per system — what a reader on
              the wrong machine or with no JavaScript uses. Raised cards, not
              bare blocks: each one is an object holding a system's files. */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">{t.builds.title}</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {systems.map((system) => (
                <div key={system.os} className={`${panelStatic} p-6`}>
                  <div className="flex items-center gap-3">
                    <IconChip icon={SYSTEM_ICON[system.os]} tone="ink" size="md" />
                    <h3 className="text-lg font-bold">{system.name}</h3>
                  </div>
                  <ul className="mt-5 space-y-3">
                    {system.builds.map((build) => (
                      <li key={build.url}>
                        <a
                          href={build.url}
                          rel="noopener"
                          className="group inline-flex items-baseline gap-2.5 font-semibold text-accent-deep no-underline"
                        >
                          <span className="group-hover:underline">{build.label}</span>
                          <FiDownload
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 translate-y-0.5 transition-transform duration-150 group-hover:translate-y-1"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Show one system's first-launch help at a time. Detection makes the
            useful answer immediate; the small switcher keeps every platform
            reachable when the browser guesses wrong.
            The band is the home page's: the last section warms the page on the
            way into the ink footer. No top margin — the band owns its air. */}
        <Band flush>
          <section>
            <h2 className="text-2xl font-bold tracking-tight">{t.firstOpen.title}</h2>
            <PlatformGuide systems={systems} firstOpen={t.firstOpen} command={t.command} />
          </section>
        </Band>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
