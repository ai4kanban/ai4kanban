import { Header } from "@/components/Header";
import { Rich } from "@/components/Rich";
import { SiteFooter } from "@/components/SiteFooter";
import { IconChip } from "@/components/ui/IconChip";
import { PlatformCta } from "@/components/download/PlatformCta";
import { SYSTEM_ICON, releaseBuilds } from "@/components/download/builds";
import { panelInset, panelStatic, heroTop } from "@/components/styles";
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
// aimed at the system they are on, a card per system holding every file, and
// the version of the release all of it points into. Everything the app tells
// you itself once it is open — how it picks a project, how it handles updates —
// stayed off it. The one section past the downloads is the unsigned warning,
// which is the only place a download here actually fails.
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
      <main className="mx-auto max-w-5xl px-6">
        <section className={heroTop}>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
            {t.hero.lead}
          </p>
          <div className="mt-8">
            <PlatformCta
              systems={systems}
              version={VERSION}
              label={t.hero.cta}
              labelAny={t.hero.ctaAny}
              releasesUrl={RELEASES_URL}
            />
          </div>
          <p className="mt-7 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
            {t.hero.note}
          </p>
        </section>

        {/* A card per system, holding every file that system has — this is the
            whole of what the old table said, minus the columns, and it is what
            a reader on the wrong machine or with no JavaScript uses. */}
        <section className="mt-20">
          {/* The version sits on the heading as well as on the button: these
              cards are the download for everyone the button guessed wrong. */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{t.builds.title}</h2>
            <span className="font-mono text-[0.85rem] text-muted">v{VERSION}</span>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {systems.map((system) => (
              <div key={system.os} className={`${panelStatic} p-6`}>
                <div className="flex items-center gap-3">
                  <IconChip icon={SYSTEM_ICON[system.os]} tone="ink" />
                  <h3 className="text-lg font-bold">{system.name}</h3>
                </div>
                {/* Bare rows: the card is the object, so nothing in it is a
                    block of its own (design.md §3). */}
                <ul className="mt-4 space-y-2.5">
                  {system.builds.map((build) => (
                    <li key={build.url}>
                      <a
                        href={build.url}
                        rel="noopener"
                        className="flex items-baseline justify-between gap-3 text-[0.95rem] font-semibold text-accent-deep no-underline hover:underline"
                      >
                        {build.label}
                        <span className="font-mono text-[0.8rem] font-normal text-muted">
                          {build.ext}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
            {t.builds.note}
          </p>
        </section>

        {/* One block for all three systems: macOS is four clicks and the other
            two are one line each, so they are rows in the same panel rather
            than three cards beside the three above. */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold tracking-tight">{t.firstOpen.title}</h2>
          <div className={`${panelInset} mt-6 p-6 sm:p-7`}>
            <h3 className="text-lg font-bold">{t.firstOpen.mac.title}</h3>
            <ol className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed text-muted">
              {t.firstOpen.mac.steps.map((step, i) => (
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
            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              {[t.firstOpen.windows, t.firstOpen.linux].map((system) => (
                <div key={system.title}>
                  <h3 className="text-lg font-bold">{system.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                    <Rich code="wash">{system.body}</Rich>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
