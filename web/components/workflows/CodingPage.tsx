import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { SolutionHeroArt } from "@/components/solutions/SolutionHeroArt";
import { getCopy } from "@/i18n";
import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { getWorkflowPage, workflowPath } from "@/lib/workflows";
import { DraftCompare, Clip, Screens } from "./Figures";

// /workflows/coding in every language. The body is `content/workflows/coding/<locale>.mdx`.
export const PATH = workflowPath("coding");

export function codingMetadata(locale: Locale) {
  const page = getWorkflowPage("coding", locale);
  return pageMetadata({
    locale,
    path: PATH,
    title: page.titleTag,
    description: page.description,
    socialTitle: page.title,
  });
}

export function CodingPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const page = getWorkflowPage("coding", locale);

  return (
    <>
      <Header c={c} locale={locale} />
      <ArticleLayout
        body={page.body}
        extra={{ Screens, Clip, DraftCompare }}
        backdrop={null}
        rule={false}
        tocLabel={page.toc}
        bodyGap="mt-6"
        header={
          <div className="pb-2 pt-4 text-center lg:pb-4 lg:pt-8">
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
              {page.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{page.lead}</p>
            <div className="mx-auto mt-4 max-w-4xl sm:mt-6">
              <SolutionHeroArt label={page.heroAlt} />
            </div>
          </div>
        }
      />
      <SiteFooter c={c} locale={locale} path={PATH} />
    </>
  );
}
