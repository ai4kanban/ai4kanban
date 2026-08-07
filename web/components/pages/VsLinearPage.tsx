import { SiteFooter } from "@/components/SiteFooter";
import { Header } from "@/components/Header";
import { SectionHeading } from "@/components/SectionHeading";
import { DecisionSection } from "@/components/vs/DecisionSection";
import {
  ComparisonIntro,
  ComparisonTable,
} from "@/components/vs/ComparisonTable";
import { VsHeroSection } from "@/components/vs/VsHeroSection";
import { WinColumns } from "@/components/vs/WinColumns";
import { LinearModel } from "@/components/vs-linear/LinearModel";
import { LinearSummary } from "@/components/vs-linear/LinearSummary";
import {
  compareRows,
  essentialCompareRows,
  kanbanWinIcons,
  kanbanWinOrder,
  linearWinIcons,
  linearWinOrder,
} from "@/components/vs-linear/vs-linear-content";
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

export const PATH = "/vs-linear";

export function VsLinearPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsLinear;
  const isCompactChinesePage = locale === "zh";
  const visibleCompareRows = isCompactChinesePage
    ? essentialCompareRows
    : compareRows;
  const rivalId = `${pageUrl(PATH)}#linear`;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-08-01",
      dateModified: isCompactChinesePage ? "2026-08-07" : "2026-08-01",
      about: [{ "@id": APP_ID }, { "@id": rivalId }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: rivalId, name: "Linear" }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale={locale} />
      <main className="mx-auto max-w-4xl px-6">
        <VsHeroSection c={t.hero} shared={c.shared} theirsTag="◩" />
        <LinearSummary c={t.summary} />

        <section className="mt-24">
          <SectionHeading num="02" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={visibleCompareRows.map((row) => ({
              key: row.key,
              winner:
                row.edge === "linear"
                  ? "theirs"
                  : row.edge === "kanban"
                    ? "ours"
                    : "neutral",
              dimension: t.comparison.rows[row.key].dimension,
              ours: t.comparison.rows[row.key].kanban,
              theirs: t.comparison.rows[row.key].linear,
            }))}
          />
        </section>

        {!isCompactChinesePage && <LinearModel c={t.model} />}

        {!isCompactChinesePage && (
          <section className="mt-24">
            <SectionHeading num="04" {...t.wins.heading} />
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
              theirsTag="◩"
              theirs={linearWinOrder.map((key) => ({
                key,
                icon: linearWinIcons[key],
                ...t.wins.theirs[key],
              }))}
            />
          </section>
        )}

        <DecisionSection
          num={isCompactChinesePage ? "03" : "05"}
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag="◩"
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
