import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { Shot } from "@/components/blog/Shot";
import { BUILDER_PATH } from "@/components/social";
import { getCopy } from "@/i18n";
import { AUTHOR } from "@/lib/blog";
import { agentPath, getAgentPage, getAgentPages } from "@/lib/agents";
import { pageMetadata } from "@/lib/metadata";
import {
  APP_ID,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";
import "../../../blog-prose.css";

// One page per coding agent — `/agents/kanban-for-codex` and its siblings. The
// body is `web/content/agents/<slug>.mdx`; everything here is the frame around
// it, so a new agent page is a new Markdown file and nothing else.
//
// Agent pages are English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

// One static page per file, which is what `output: export` needs.
export function generateStaticParams() {
  return getAgentPages().map((page) => ({ slug: page.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = getAgentPage(slug);
  if (!page) return {};

  return pageMetadata({
    locale: "en",
    path: agentPath(page),
    // `title_tag` exists for the page whose headline is right on the page and
    // wrong in a result — a result has no page around it to explain it.
    title: page.titleTag ?? page.title,
    description: page.description,
    socialTitle: page.title,
    socialImageAlt: page.socialImageAlt,
    byTao: true,
    translated: false,
  });
}

export default async function AgentPage({ params }: Params) {
  const { slug } = await params;
  const page = getAgentPage(slug);
  if (!page) notFound();

  const route = agentPath(page);
  // The page is about the product, so its main entity is the product — the
  // description here is the one written for a machine, not the meta line.
  const schema = jsonLd(
    {
      ...webPage(route, page.titleTag ?? page.title, page.schemaDescription),
      mainEntity: { "@id": APP_ID },
    },
    softwareApplication({
      id: APP_ID,
      name: "AI4Kanban",
      description: page.schemaDescription,
      url: pageUrl(""),
      free: true,
    }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" overlay />
      <ArticleLayout
        body={page.body}
        extra={{ Shot }}
        header={
          <>
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-deep">
              {page.eyebrow ? `${page.eyebrow} · ` : ""}
              {page.readMinutes} min read
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              {page.title}
            </h1>
            <p className="mt-5 text-lg text-muted">{page.lead}</p>
            {/* The byline goes to the page that says who that is. */}
            <a
              href={BUILDER_PATH}
              rel="author"
              className="mt-6 inline-block text-sm text-muted transition-colors hover:text-ink"
            >
              <span className="font-semibold text-ink">{AUTHOR.name}</span> ·{" "}
              {AUTHOR.role}
            </a>
          </>
        }
      />
      <SiteFooter c={c} locale="en" path={route} />
    </>
  );
}
