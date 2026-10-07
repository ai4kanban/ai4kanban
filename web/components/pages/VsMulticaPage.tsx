import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import { ComparisonIntro } from "@/components/vs/ComparisonTable";
import { MulticaHero } from "@/components/vs-multica/MulticaHero";
import { MulticaMark } from "@/components/vs-multica/MulticaMark";
import {
  MulticaTable,
  type MulticaRow,
} from "@/components/vs-multica/MulticaTable";
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
const ROWS: { key: VsMulticaRowKey; winner: MulticaRow["winner"] }[] = [
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
        <MulticaHero c={t.hero} />

        <section className="mt-24">
          <SectionHeading num="01" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <MulticaTable
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
