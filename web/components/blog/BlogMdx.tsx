import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import * as figures from "./figures";
import { Callout, FAQ, FAQItem, KeyTakeaways, Quote, TLDR } from "./MdxBlocks";
import { ProseCode } from "./ProseCode";
import { getCopy } from "@/i18n";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

// A post's body, compiled at build time. A server component: `MDXRemote` runs
// the MDX compiler, which never reaches the browser.
//
// Two plugins and no more. `remark-gfm` is what makes a table, a task list and
// a strikethrough work — the Markdown people actually type. `rehype-slug` puts
// an `id` on every heading, which is what the "on this page" rail links to.
//
// There is deliberately no syntax highlighter: every code block on this site is
// ink on the wash, in the terminals on the landing page and in `CodeBlock.tsx`
// alike, and a post is not the one place that grows six token colours.
//
// Styling is `.blog-prose` in `app/blog-prose.css`; keep class names out of
// this file so the stylesheet stays the one place a post's type is set.

// The blog is English-only — see `TRANSLATED_PATHS` in lib/i18n.ts.
const code = getCopy("en").shared.code;

const components = {
  // Every figure in `figures/`, by name, so a post can draw one with a tag.
  // Anything a post needs to *show* is a drawing built to the site's grammar
  // rather than markup written inline in the Markdown.
  ...figures,
  // The blocks a post can write that prose has no syntax for (`MdxBlocks.tsx`).
  // The set is closed: a body chooses from these, it does not invent markup.
  TLDR,
  KeyTakeaways,
  Callout,
  Quote,
  FAQ,
  FAQItem,
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <ProseCode {...props} labels={code} />
  ),
  // A table wide enough to overflow scrolls inside its own region rather than
  // taking the page sideways with it.
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="prose-table">
      <table {...props} />
    </div>
  ),
  // An outbound link opens where it was clicked; `noopener` because a link that
  // hands the new tab a handle on this one is a link that can rewrite it.
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) =>
    href.startsWith("http") ? (
      <a href={href} rel="noopener" {...props} />
    ) : (
      <a href={href} {...props} />
    ),
};

/**
 * A long-form body — a post, or a documentation page — compiled and styled.
 *
 * `extra` adds to the closed set above for a caller whose bodies can write one
 * more tag than a post can: the documentation passes its navigation cards.
 */
export function BlogMdx({
  source,
  extra,
}: {
  source: string;
  extra?: ComponentProps<typeof MDXRemote>["components"];
}) {
  return (
    <div className="blog-prose">
      <MDXRemote
        source={source}
        components={{ ...components, ...extra }}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </div>
  );
}
