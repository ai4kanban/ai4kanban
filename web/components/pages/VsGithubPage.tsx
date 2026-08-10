import { FaGithub } from "react-icons/fa";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { VsHeroSection } from "@/components/vs/VsHeroSection";
import {
  GithubHeroDiagram,
  KanbanHeroDiagram,
} from "@/components/vs-github-issues/GhDiagrams";
import {
  ComparisonTable,
  ComparisonIntro,
} from "@/components/vs/ComparisonTable";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { compareRows } from "@/components/vs-github-issues/vs-content";
import { getCopy } from "@/i18n";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";
import type { Locale } from "@/lib/i18n";

export const PATH = "/vs-github-issues";

export function VsGithubPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsGithub;
  const RIVAL_ID = `${pageUrl(PATH)}#github-issues`;

  // `datePublished` is when the page shipped; bump `dateModified` when the
  // argument changes, not for copy tweaks.
  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-07-15",
      dateModified: "2026-07-27",
      about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({
      id: RIVAL_ID,
      name: "GitHub Issues",
      operatingSystem: "Web",
    }),
  );

  const githubMark = <FaGithub className="text-ink" aria-hidden="true" />;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale={locale} />
      <main className="mx-auto max-w-4xl px-6">
        <VsHeroSection
          c={t.hero}
          shared={c.shared}
          theirsTag={githubMark}
          oursExtra={<KanbanHeroDiagram c={t.hero} />}
          theirsExtra={<GithubHeroDiagram c={t.hero} />}
        />

        <section className="mt-24">
          <SectionHeading num="01" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={compareRows.map((r) => ({
              key: r.key,
              winner: r.edge === "issues" ? "theirs" : r.edge === "kanban" ? "ours" : "neutral",
              dimension: t.comparison.rows[r.key].dimension,
              ours: t.comparison.rows[r.key].kanban,
              theirs: t.comparison.rows[r.key].issues,
            }))}
          />
        </section>

        <DecisionSection
          num="02"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={githubMark}
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
