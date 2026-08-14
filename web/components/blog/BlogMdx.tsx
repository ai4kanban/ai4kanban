import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { ProseCode } from "./ProseCode";
import { getCopy } from "@/i18n";
import type { ComponentPropsWithoutRef } from "react";

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

export function BlogMdx({ source }: { source: string }) {
  return (
    <div className="blog-prose">
      <MDXRemote
        source={source}
        components={components}
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
