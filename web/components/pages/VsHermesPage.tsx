import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { VsHeroSection } from "@/components/vs/VsHeroSection";
import {
  ComparisonIntro,
  ComparisonTable,
} from "@/components/vs/ComparisonTable";
import { WinColumns } from "@/components/vs/WinColumns";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { HermesMark } from "@/components/vs-hermes-kanban/HermesMark";
import {
  HermesDiagram,
  SkillDiagram,
} from "@/components/vs-hermes-kanban/HkDiagrams";
import { HkSummary } from "@/components/vs-hermes-kanban/HkSummary";
import { HkHarness } from "@/components/vs-hermes-kanban/HkHarness";
import { HkMemory } from "@/components/vs-hermes-kanban/HkMemory";
import { HkAutonomy } from "@/components/vs-hermes-kanban/HkAutonomy";
import { HkGui } from "@/components/vs-hermes-kanban/HkGui";
import {
  compareRows,
  hermesWinIcons,
  hermesWinOrder,
  kanbanWinIcons,
  kanbanWinOrder,
} from "@/components/vs-hermes-kanban/vs-hermes-content";
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

export const PATH = "/vs-hermes-kanban";

export function VsHermesPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsHermes;
  const RIVAL_ID = `${pageUrl(PATH)}#hermes-agent-kanban`;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-07-19",
      dateModified: "2026-07-27",
      about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: RIVAL_ID, name: "Hermes Agent Kanban" }),
  );

  const hermesTag = <HermesMark className="h-5 w-5" />;

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
          theirsTag={hermesTag}
          oursExtra={<SkillDiagram c={t.hero} />}
          theirsExtra={<HermesDiagram c={t.hero} />}
        />
        <HkSummary c={t.summary} />
        <HkHarness
          c={t.harness}
          labels={{
            ours: t.comparison.ourLabel,
            theirs: t.comparison.theirLabel,
          }}
        />

        <section className="mt-24">
          <SectionHeading num="03" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={compareRows.map((r) => ({
              key: r.key,
              winner:
                r.edge === "hermes"
                  ? "theirs"
                  : r.edge === "kanban"
                    ? "ours"
                    : "neutral",
              dimension: t.comparison.rows[r.key].dimension,
              ours: t.comparison.rows[r.key].kanban,
              theirs: t.comparison.rows[r.key].hermes,
            }))}
          />
        </section>

        <HkMemory c={t.memory} />
        <HkAutonomy c={t.autonomy} />
        <HkGui c={t.gui} />

        <section className="mt-24">
          <SectionHeading num="07" {...t.wins.heading} />
          <p className="text-ink">{t.wins.lead}</p>
          <WinColumns
            oursHeading={t.wins.oursHeading}
            oursTag="🗂️"
            ours={kanbanWinOrder.map((k) => ({
              key: k,
              icon: kanbanWinIcons[k],
              ...t.wins.ours[k],
            }))}
            theirsHeading={t.wins.theirsHeading}
            theirsTag={<HermesMark className="h-6 w-6" />}
            theirs={hermesWinOrder.map((k) => ({
              key: k,
              icon: hermesWinIcons[k],
              ...t.wins.theirs[k],
            }))}
          />
        </section>

        <DecisionSection
          num="08"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={<HermesMark className="h-6 w-6" />}
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
