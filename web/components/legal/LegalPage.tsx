import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleLayout } from "@/components/blog/ArticleLayout";
import { getCopy } from "@/i18n";
import { formatDate } from "@/lib/blog";
import type { LegalDoc } from "@/lib/legal";
import { jsonLd, webPage } from "@/lib/schema";

// A legal page is a post without the byline or the `Article` node. Each route
// imports `app/blog-prose.css` itself, the way the post route does.
//
// The legal pages are English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const c = getCopy("en");

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const schema = jsonLd(webPage(doc.path, doc.title, doc.description));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" overlay />
      <ArticleLayout
        body={doc.body}
        header={
          <>
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-deep">
              Legal · Effective{" "}
              <time dateTime={doc.effective.slice(0, 10)}>
                {formatDate(doc.effective)}
              </time>
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              {doc.title}
            </h1>
            <p className="mt-5 text-lg text-muted">{doc.lead}</p>
          </>
        }
      />
      <SiteFooter c={c} locale="en" path={doc.path} />
    </>
  );
}
