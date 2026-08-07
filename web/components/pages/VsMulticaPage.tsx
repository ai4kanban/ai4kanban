import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import {
  ComparisonIntro,
  ComparisonTable,
} from "@/components/vs/ComparisonTable";
import { VsHeroSection } from "@/components/vs/VsHeroSection";
import { WinColumns } from "@/components/vs/WinColumns";
import { MulticaBacklog } from "@/components/vs-multica/MulticaBacklog";
import { MulticaHorizon } from "@/components/vs-multica/MulticaHorizon";
import {
  KanbanHeroDiagram,
  MulticaHeroDiagram,
  MulticaLifecycle,
} from "@/components/vs-multica/MulticaLifecycle";
import { MulticaMark } from "@/components/vs-multica/MulticaMark";
import { MulticaMemory } from "@/components/vs-multica/MulticaMemory";
import {
  compareRows,
  kanbanWinIcons,
  kanbanWinOrder,
  multicaWinIcons,
  multicaWinOrder,
} from "@/components/vs-multica/vs-multica-content";
import { getCopy } from "@/i18n";
import { LogoMark } from "@/components/ui/Logo";
import type { Locale } from "@/lib/i18n";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

export const PATH = "/vs-multica";

export function VsMulticaPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsMultica;
  const rivalId = `${pageUrl(PATH)}#multica`;
  const multicaTag = <MulticaMark className="h-5 w-5" />;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-08-07",
      dateModified: "2026-08-07",
      about: [{ "@id": APP_ID }, { "@id": rivalId }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({
      id: rivalId,
      name: "Multica",
      url: "https://multica.ai/",
    }),
  );

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
          theirsTag={multicaTag}
          oursExtra={<KanbanHeroDiagram c={t.hero} />}
          theirsExtra={<MulticaHeroDiagram c={t.hero} />}
        />

        <MulticaLifecycle c={t.boundary} />
        <MulticaBacklog c={t.backlog} />

        <section className="mt-24">
          <SectionHeading num="03" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={compareRows.map((row) => ({
              key: row.key,
              winner:
                row.edge === "multica"
                  ? "theirs"
                  : row.edge === "kanban"
                    ? "ours"
                    : "neutral",
              dimension: t.comparison.rows[row.key].dimension,
              ours: t.comparison.rows[row.key].kanban,
              theirs: t.comparison.rows[row.key].multica,
            }))}
          />
        </section>

        <MulticaMemory c={t.memory} />
        <MulticaHorizon c={t.horizon} />

        <section className="mt-24">
          <SectionHeading num="06" {...t.wins.heading} />
          <p className="text-ink">
            {t.wins.lead}
          </p>
          <WinColumns
            oursHeading={t.wins.oursHeading}
            oursTag={<LogoMark size="xs" />}
            ours={kanbanWinOrder.map((key) => ({
              key,
              icon: kanbanWinIcons[key],
              ...t.wins.ours[key],
            }))}
            theirsHeading={t.wins.theirsHeading}
            theirsTag={multicaTag}
            theirs={multicaWinOrder.map((key) => ({
              key,
              icon: multicaWinIcons[key],
              ...t.wins.theirs[key],
            }))}
          />
        </section>

        <DecisionSection
          num="07"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={multicaTag}
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
