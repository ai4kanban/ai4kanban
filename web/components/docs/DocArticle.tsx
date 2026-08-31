import { BlogMdx } from "../blog/BlogMdx";
import { TocBlock } from "../blog/BlogToc";
import { Card, CardGroup } from "./DocCards";
import { CopyPage } from "./CopyPage";
import { extractToc } from "@/lib/blog";
import type { DocPage } from "@/lib/docs";

// One documentation page: the opening, then the body.
//
// The opening is the blog post's, and on purpose — a title, the sentence under
// it, and the site's rule to close it, so a doc and a post are the same kind of
// page to read. What it adds is the pair a doc needs and a post doesn't: the
// date the page was last checked, and the button that hands you its Markdown.
//
// "On this page" is the folded block rather than the rail, at every width: the
// left column is already the route rail, and three columns inside the site's
// content width leaves nothing for the prose.
//
// The route rail and the page chrome belong to the layout — this is the column.
//
// `toc` is off for the landing page: it is a set of cards that send you
// somewhere else, not a page read top to bottom, and a contents list over it
// would name the same four destinations twice.
export function DocArticle({
  doc,
  toc: showToc = true,
}: {
  doc: DocPage;
  toc?: boolean;
}) {
  const toc = extractToc(doc.body);

  return (
    <article className="min-w-0 flex-1">
      <header className="border-b-2 border-border pb-8">
        <h1 className="text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-5 text-lg text-muted">{doc.lead}</p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">Updated {doc.lastUpdated}</p>
          <CopyPage markdown={doc.body} />
        </div>
      </header>

      <div className="mt-10">
        {showToc && <TocBlock items={toc} noRail />}
        <BlogMdx source={doc.body} extra={{ Card, CardGroup }} />
      </div>
    </article>
  );
}
