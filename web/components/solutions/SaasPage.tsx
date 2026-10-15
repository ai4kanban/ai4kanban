import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { Screens } from "@/components/workflows/Figures";
import { getCopy } from "@/i18n";
import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { jsonLd, webPage } from "@/lib/schema";
import { SAAS_PATH, getSaasPage } from "@/lib/workflows";
import { Action, Board, Closing, Plan } from "./Blocks";
import { SaasHeroArt } from "./SaasHeroArt";

// /solutions/saas in every language: the coding page's shape with the body in
// `content/solutions/saas/<locale>.mdx`. The H1's lines are the title's lines.

export function saasMetadata(locale: Locale) {
  const page = getSaasPage(locale);
  return pageMetadata({
    locale,
    path: SAAS_PATH,
    title: page.titleTag,
    description: page.description,
    socialTitle: page.socialTitle,
    social: page.social,
  });
}

export function SaasPage({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const page = getSaasPage(locale);
  const schema = jsonLd(webPage(SAAS_PATH, page.titleTag, page.schema, { locale }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={c} locale={locale} />
      <ArticleLayout
        body={page.body}
        extra={{ Screens, Board, Plan, Action, Closing }}
        backdrop={null}
        rule={false}
        tocLabel={page.toc}
        bodyGap="mt-6"
        header={
          <div className="pb-2 pt-4 text-center lg:pb-4 lg:pt-8">
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
              AI4Kanban for SaaS
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.15] tracking-tight sm:text-6xl sm:leading-[1.05]">
              {page.title.split("\n").map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted">{page.lead}</p>
            <div className="mx-auto mt-4 max-w-4xl sm:mt-6">
              <SaasHeroArt label={page.heroAlt} />
            </div>
          </div>
        }
      />
      <SiteFooter c={c} locale={locale} path={SAAS_PATH} />
    </>
  );
}
