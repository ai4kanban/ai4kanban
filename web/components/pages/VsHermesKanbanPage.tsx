import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { ComparisonIntro } from "@/components/vs/ComparisonTable";
import { EmptyAgent, EmptySlot, FormScene } from "@/components/vs/HeroVisuals";
import { TopicHero } from "@/components/vs/TopicHero";
import { VsTable, type VsRow } from "@/components/vs/VsTable";
import { HermesMark } from "@/components/vs-hermes-kanban/HermesMark";
import { FiEye, FiFileText } from "react-icons/fi";
import type { VsHermesRowKey } from "@/i18n/vs-hermes-kanban/types";
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

export const PATH = "/vs-hermes-kanban";

// Which side is stronger on each row; AI4Kanban's rows first.
const ROWS: { key: VsHermesRowKey; winner: VsRow["winner"] }[] = [
  { key: "startingPoint", winner: "ours" },
  { key: "planning", winner: "ours" },
  { key: "drafts", winner: "ours" },
  { key: "questions", winner: "ours" },
  { key: "memory", winner: "neutral" },
  { key: "followUps", winner: "ours" },
  { key: "landing", winner: "ours" },
  { key: "recurring", winner: "ours" },
  { key: "harness", winner: "ours" },
  { key: "interface", winner: "neutral" },
  { key: "review", winner: "neutral" },
  { key: "chat", winner: "theirs" },
  { key: "recovery", winner: "theirs" },
  { key: "api", winner: "theirs" },
];

export function VsHermesKanbanPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsHermes;
  const rivalId = `${pageUrl(PATH)}#hermes-agent-kanban`;
  const hkTag = <HermesMark className="h-5 w-5" />;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-07-19",
      dateModified: "2026-10-09",
      about: [{ "@id": APP_ID }, { "@id": rivalId }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: rivalId, name: "Hermes Agent Kanban" }),
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
            name: "Hermes Kanban",
            mark: hkTag,
            art: {
              setup: (
                <FormScene c={t.hero.setup.art.theirs}>
                  <EmptyAgent />
                </FormScene>
              ),
              drafts: (
                <FormScene c={t.hero.drafts.art.theirs}>
                  <EmptySlot>
                    <FiFileText aria-hidden="true" />
                  </EmptySlot>
                </FormScene>
              ),
              questions: (
                <FormScene c={t.hero.questions.art.theirs}>
                  <EmptySlot>
                    <FiEye aria-hidden="true" />
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
                theirs: row.hermes,
              };
            })}
          />
        </section>

        <DecisionSection
          num="02"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={hkTag}
          framed
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
