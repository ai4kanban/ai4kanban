import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { TmBoardShape } from "@/components/vs-task-master/TmBoardShape";
import { TmHero, TmOverview, TmWorkflow, TmComparison, TmTradeoffs, TmDecision } from "@/components/vs-task-master/TmSections";
import { column } from "@/components/styles";
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

export function VsTaskMasterPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const t = c.vsTaskMaster;
  const rivalId = `${pageUrl(PATH)}#task-master`;

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
      <main>
        <div className={column}>
          <TmHero c={t.hero} />
          <TmOverview c={t.summary} />
          <TmWorkflow c={t.start} />
          <TmComparison c={t.comparison} />
          <TmBoardShape c={t.boardShape} />
          <TmTradeoffs c={t.wins} />
        </div>
        <TmDecision c={t.decision} shared={c.shared} locale={locale} />
      </main>
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
