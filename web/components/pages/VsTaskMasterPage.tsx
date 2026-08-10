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
import { TmBoardShape } from "@/components/vs-task-master/TmBoardShape";
import {
  KanbanHeroDiagram,
  TaskMasterHeroDiagram,
} from "@/components/vs-task-master/TmDiagrams";
import { TmMark } from "@/components/vs-task-master/TmMark";
import { TmStart } from "@/components/vs-task-master/TmStart";
import { TmSummary } from "@/components/vs-task-master/TmSummary";
import {
  compareRows,
  kanbanWinIcons,
  kanbanWinOrder,
  taskMasterWinIcons,
  taskMasterWinOrder,
} from "@/components/vs-task-master/vs-task-master-content";
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

export const PATH = "/vs-task-master";

export function VsTaskMasterPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsTaskMaster;
  const rivalId = `${pageUrl(PATH)}#task-master`;
  const tmTag = <TmMark className="h-5 w-5" />;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-08-10",
      dateModified: "2026-08-10",
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
      name: "Task Master",
      url: "https://github.com/eyaltoledano/claude-task-master",
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
          theirsTag={tmTag}
          oursExtra={<KanbanHeroDiagram c={t.hero} />}
          theirsExtra={<TaskMasterHeroDiagram c={t.hero} />}
        />

        <TmSummary c={t.summary} />
        <TmStart c={t.start} />

        <section className="mt-24">
          <SectionHeading num="03" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={compareRows.map((row) => ({
              key: row.key,
              winner:
                row.edge === "taskMaster"
                  ? "theirs"
                  : row.edge === "kanban"
                    ? "ours"
                    : "neutral",
              dimension: t.comparison.rows[row.key].dimension,
              ours: t.comparison.rows[row.key].kanban,
              theirs: t.comparison.rows[row.key].taskMaster,
            }))}
          />
        </section>

        <TmBoardShape c={t.boardShape} />

        <section className="mt-24">
          <SectionHeading num="05" {...t.wins.heading} />
          <p className="text-ink">{t.wins.lead}</p>
          <WinColumns
            oursHeading={t.wins.oursHeading}
            oursTag={<LogoMark size="xs" />}
            ours={kanbanWinOrder.map((key) => ({
              key,
              icon: kanbanWinIcons[key],
              ...t.wins.ours[key],
            }))}
            theirsHeading={t.wins.theirsHeading}
            theirsTag={tmTag}
            theirs={taskMasterWinOrder.map((key) => ({
              key,
              icon: taskMasterWinIcons[key],
              ...t.wins.theirs[key],
            }))}
          />
        </section>

        <DecisionSection
          num="06"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={tmTag}
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
