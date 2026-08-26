import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogMdx } from "@/components/blog/BlogMdx";
import { heroTop } from "@/components/styles";
import { getCopy } from "@/i18n";
import { formatDate } from "@/lib/blog";
import type { LegalDoc } from "@/lib/legal";
import { jsonLd, webPage } from "@/lib/schema";

// The shell both legal pages render into. It is a post's page without a post's
// furniture: the body is MDX through the blog's components and `.blog-prose`,
// and what is left out is the author line, the "on this page" rail, and the
// `Article` node that would claim this is journalism. Each route imports
// `app/blog-prose.css` itself, the way the post route does.
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
      <Header c={c} locale="en" />
      <main className="mx-auto max-w-3xl px-6 pb-8">
        <article>
          <header className={`${heroTop} border-b-2 border-border pb-10`}>
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
              AI4Kanban · Legal
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
              {doc.title}
            </h1>
            <p className="mt-5 text-lg text-muted">{doc.lead}</p>
            <p className="mt-6 text-sm text-muted">
              Effective{" "}
              <time dateTime={doc.effective.slice(0, 10)}>
                {formatDate(doc.effective)}
              </time>
            </p>
          </header>

          <div className="mt-12">
            <BlogMdx source={doc.body} />
          </div>
        </article>
      </main>
      <SiteFooter c={c} locale="en" path={doc.path} />
    </>
  );
}
