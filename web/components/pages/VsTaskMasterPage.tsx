import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { ComparisonIntro } from "@/components/vs/ComparisonTable";
import {
  EmptySlot,
  FormScene,
  MissingList,
} from "@/components/vs/HeroVisuals";
import { TopicHero } from "@/components/vs/TopicHero";
import { VsTable, type VsRow } from "@/components/vs/VsTable";
import { TmMark } from "@/components/vs-task-master/TmMark";
import { FiEdit3, FiEye } from "react-icons/fi";
import type { VsTaskMasterRowKey } from "@/i18n/vs-task-master/types";
import { getCopy } from "@/i18n";
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

// Which side is stronger on each row; AI4Kanban's rows first.
const ROWS: { key: VsTaskMasterRowKey; winner: VsRow["winner"] }[] = [
  { key: "startingPoint", winner: "ours" },
  { key: "planning", winner: "neutral" },
  { key: "drafts", winner: "ours" },
  { key: "discussion", winner: "ours" },
  { key: "memory", winner: "ours" },
  { key: "followUps", winner: "ours" },
  { key: "interface", winner: "neutral" },
  { key: "execution", winner: "neutral" },
  { key: "testFirst", winner: "theirs" },
  { key: "research", winner: "theirs" },
  { key: "reach", winner: "theirs" },
  { key: "license", winner: "ours" },
];

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
      dateModified: "2026-10-09",
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
      name: "Taskmaster",
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
        <TopicHero
          c={t.hero}
          rival={{
            name: "Taskmaster",
            mark: tmTag,
            art: {
              setup: <MissingList c={t.hero.setup.art.theirs} />,
              drafts: (
                <FormScene c={t.hero.drafts.art.theirs}>
                  <EmptySlot>
                    <FiEye aria-hidden="true" />
                  </EmptySlot>
                </FormScene>
              ),
              memory: (
                <FormScene c={t.hero.memory.art.theirs}>
                  <EmptySlot>
                    <FiEdit3 aria-hidden="true" />
                  </EmptySlot>
                </FormScene>
              ),
            },
          }}
        />

        <section className="mt-24">
          <SectionHeading num="01" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <VsTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={ROWS.map(({ key, winner }) => {
              const row = t.comparison.rows[key];
              return {
                key,
                winner,
                dimension: row.dimension,
                ours: row.kanban,
                theirs: row.taskMaster,
              };
            })}
          />
        </section>

        <DecisionSection
          num="02"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={tmTag}
          framed
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
