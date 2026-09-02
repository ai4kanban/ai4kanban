import type { ComponentProps, ReactNode } from "react";
import { Backdrop } from "./Backdrop";
import { BlogMdx } from "./BlogMdx";
import { TocBlock, TocRail } from "./BlogToc";
import { extractToc } from "@/lib/blog";

// The shape a long-form page has: the opening above the site's rule, then the
// body with the "on this page" rail beside it once there is room. A post and a
// standalone guide are the same page with different openings, so the widths and
// the rail live here rather than in each route.
//
// It also brings the plate the opening sits on. That is why the opening is
// full-bleed and the body is not: the plate fills the block it is in, so the
// block has to be the whole width and has to end where the opening ends — at
// the rule, with the body on clean paper below it. The page's own header has to
// know about it too: pass `overlay` to `Header` so the row lets the plate
// through until the page scrolls.
//
// The page that uses it imports `app/blog-prose.css`, which is where the body's
// type is set.
export function ArticleLayout({
  header,
  body,
  extra,
}: {
  header: ReactNode;
  body: string;
  /** One more tag this body may write than a post can — see `BlogMdx`. */
  extra?: ComponentProps<typeof BlogMdx>["extra"];
}) {
  const toc = extractToc(body);

  return (
    <main className="pb-8">
      <article>
        {/* Full-bleed so the plate is, but the rule stays in the column: it
            belongs to the opening, not to the page's edges. */}
        <header className="relative">
          <Backdrop />
          <div className="mx-auto max-w-5xl px-6 pt-10 lg:pt-16">
            <div className="border-b-2 border-border pb-10">{header}</div>
          </div>
        </header>
        <div className="mx-auto mt-12 max-w-5xl px-6 lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12">
          <TocRail items={toc} />
          <div className="min-w-0">
            <TocBlock items={toc} />
            <BlogMdx source={body} extra={extra} />
          </div>
        </div>
      </article>
    </main>
  );
}
