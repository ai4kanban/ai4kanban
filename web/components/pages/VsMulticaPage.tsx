import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { ComparisonIntro } from "@/components/vs/ComparisonTable";
import {
  EmptyAgent,
  EmptySlot,
  FormScene,
} from "@/components/vs/HeroVisuals";
import { TopicHero } from "@/components/vs/TopicHero";
import { VsTable, type VsRow } from "@/components/vs/VsTable";
import { MulticaMark } from "@/components/vs-multica/MulticaMark";
import { FiPlus } from "react-icons/fi";
import type { VsMulticaRowKey } from "@/i18n/vs-multica/types";
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

export const PATH = "/vs-multica";

// Which side is stronger on each row; AI4Kanban's rows first.
const ROWS: { key: VsMulticaRowKey; winner: VsRow["winner"] }[] = [
  { key: "startingPoint", winner: "ours" },
  { key: "refinement", winner: "ours" },
  { key: "memory", winner: "ours" },
  { key: "backlog", winner: "ours" },
  { key: "license", winner: "ours" },
  { key: "execution", winner: "theirs" },
  { key: "teams", winner: "theirs" },
];

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
      dateModified: "2026-10-07",
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
        <TopicHero
          c={t.hero}
          rival={{
            name: "Multica",
            mark: multicaTag,
            // Every topic on Multica's side: a blank form you fill in.
            art: {
              setup: (
                <FormScene c={t.hero.setup.art.theirs}>
                  <EmptyAgent />
                </FormScene>
              ),
              drafts: (
                <FormScene c={t.hero.drafts.art.theirs}>
                  <EmptySlot>
                    <FiPlus aria-hidden="true" />
                  </EmptySlot>
                </FormScene>
              ),
              memory: (
                <FormScene c={t.hero.memory.art.theirs}>
                  <EmptySlot>
                    <FiPlus aria-hidden="true" />
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
                oursTip: row.kanbanTip,
                theirs: row.multica,
              };
            })}
          />
        </section>

        <DecisionSection
          num="02"
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={multicaTag}
          framed
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
