import type { ComponentProps, ReactNode } from "react";
import { BlogMdx } from "./BlogMdx";
import { TocBlock, TocRail } from "./BlogToc";
import { extractToc } from "@/lib/blog";

// The shape a long-form page has: the opening above the site's rule, then the
// body with the "on this page" rail beside it once there is room. A post and a
// standalone guide are the same page with different openings, so the widths and
// the rail live here rather than in each route.
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
    <main className="mx-auto max-w-5xl px-6 pb-8">
      <article>
        <header className="mt-10 border-b-2 border-border pb-10 lg:mt-16">
          {header}
        </header>
        <div className="mt-12 lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12">
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
