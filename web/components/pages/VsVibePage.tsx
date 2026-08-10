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
import {
  KanbanHeroDiagram,
  VibeHeroDiagram,
} from "@/components/vs-vibe-kanban/VkDiagrams";
import { VkSummary } from "@/components/vs-vibe-kanban/VkSummary";
import { VkPurpose } from "@/components/vs-vibe-kanban/VkPurpose";
import { VibeKanbanMark } from "@/components/vs-vibe-kanban/VibeKanbanMark";
import {
  compareRows,
  kanbanWinIcons,
  kanbanWinOrder,
  vibeWinIcons,
  vibeWinOrder,
} from "@/components/vs-vibe-kanban/vs-vibe-content";
import { getCopy } from "@/i18n";
import {
  APP_ID,
  article,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";
import { LogoMark } from "@/components/ui/Logo";
import type { Locale } from "@/lib/i18n";

export const PATH = "/vs-vibe-kanban";

export function VsVibePage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsVibe;
  const isCompactChinese = locale === "zh";
  const vibeTag = <VibeKanbanMark />;
  const RIVAL_ID = `${pageUrl(PATH)}#vibe-kanban`;
  const rows = isCompactChinese
    ? compareRows.filter(({ key }) =>
        [
          "whatFor",
          "orchestration",
          "review",
          "planning",
          "runsAs",
          "maintenance",
        ].includes(key),
      )
    : compareRows;

  const schema = jsonLd(
    webPage(PATH, t.meta.title, t.meta.description, { locale }),
    article({
      path: PATH,
      locale,
      headline: t.meta.socialTitle ?? t.meta.title,
      description: t.meta.description,
      datePublished: "2026-07-25",
      dateModified: "2026-07-27",
      about: [{ "@id": APP_ID }, { "@id": RIVAL_ID }],
    }),
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      url: pageUrl(""),
      free: true,
    }),
    softwareApplication({ id: RIVAL_ID, name: "Vibe Kanban" }),
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
          theirsTag={vibeTag}
          oursExtra={<KanbanHeroDiagram c={t.hero} />}
          theirsExtra={<VibeHeroDiagram c={t.hero} />}
        />
        <VkSummary c={t.summary} />

        <section className="mt-24">
          <SectionHeading num="02" {...t.comparison.heading} />
          <ComparisonIntro>{t.comparison.lead}</ComparisonIntro>
          <ComparisonTable
            ourLabel={t.comparison.ourLabel}
            theirLabel={t.comparison.theirLabel}
            rows={rows.map((r) => ({
              key: r.key,
              winner:
                r.edge === "vibe"
                  ? "theirs"
                  : r.edge === "kanban"
                    ? "ours"
                    : "neutral",
              dimension: t.comparison.rows[r.key].dimension,
              ours: t.comparison.rows[r.key].kanban,
              theirs: t.comparison.rows[r.key].vibe,
            }))}
          />
        </section>

        {!isCompactChinese && <VkPurpose c={t.purpose} />}

        {!isCompactChinese && (
          <section className="mt-24">
            <SectionHeading num="04" {...t.wins.heading} />
            <p className="text-ink">{t.wins.lead}</p>
            <WinColumns
              oursHeading={t.wins.oursHeading}
              oursTag={<LogoMark size="xs" />}
              ours={kanbanWinOrder.map((k) => ({
                key: k,
                icon: kanbanWinIcons[k],
                ...t.wins.ours[k],
              }))}
              theirsHeading={t.wins.theirsHeading}
              theirsTag={vibeTag}
              theirs={vibeWinOrder.map((k) => ({
                key: k,
                icon: vibeWinIcons[k],
                ...t.wins.theirs[k],
              }))}
            />
          </section>
        )}

        <DecisionSection
          num={isCompactChinese ? "03" : "05"}
          c={t.decision}
          shared={c.shared}
          locale={locale}
          theirsTag={vibeTag}
        />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
