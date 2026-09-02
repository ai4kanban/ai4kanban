import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PixelMark } from "@/components/ui/PixelMark";
import { DownloadBlock } from "@/components/download/DownloadBlock";
import { PlatformGuide } from "@/components/download/PlatformGuide";
import { releaseBuilds } from "@/components/download/builds";
import { column, heroTop } from "@/components/styles";
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
          {/* One block: the offer, the button, and every file under them. */}
          <section className={heroTop}>
            <DownloadBlock
              systems={systems}
              version={VERSION}
              title={t.hero.title}
              lead={t.hero.lead}
              cta={t.hero.cta}
              ctaFor={t.hero.ctaFor}
              buildsTitle={t.builds.title}
              fallback={RELEASES_URL}
            />
          </section>

          {/* Show one system's first-launch help at a time. Detection makes the
              useful answer immediate; the small switcher keeps every platform
              reachable when the browser guesses wrong.
              On the open page, not a band: the block above already carries three
              fills, and a warm ground under this one would leave the page with
              no white left. The pixel mark is what the band was for — it opens
              the section in the site's own texture. */}
          <section className="mt-24">
            <PixelMark className="mb-5" />
            <h2 className="text-2xl font-bold tracking-tight">{t.firstOpen.title}</h2>
            <PlatformGuide systems={systems} firstOpen={t.firstOpen} command={t.command} />
          </section>
        </div>
      </main>
      <SiteFooter c={copy} locale={locale} path={PATH} />
    </>
  );
}
