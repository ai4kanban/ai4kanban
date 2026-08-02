"use client";

import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { useOpenIds } from "./open-ids";

// react-markdown strips URLs with unknown protocols, which would drop our
// `card:<id>` scheme. Let those through; sanitize everything else as usual.
const urlTransform = (url: string) =>
  url.startsWith("card:") ? url : defaultUrlTransform(url);

// remark plugin: turn `#<number>` in PLAIN TEXT into a card link, but only for
// ids that are still open. Because it visits mdast `text` nodes only, `#12`
// inside inline code or a fenced block (which live on `inlineCode`/`code` nodes)
// is never touched. Non-open ids are left as plain text — no dead links.
function remarkCardLinks(openIds: Set<number>) {
  // A unified plugin is an attacher `() => transformer`; the extra layer is what
  // unified calls to get the transformer. Returning the transformer directly
  // makes unified invoke it with no tree.
  return () => (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "text", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      const value: string = node.value;
      const regex = /#(\d+)/g;
      const children: unknown[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      let hit = false;
      while ((match = regex.exec(value))) {
        const id = Number(match[1]);
        if (!openIds.has(id)) continue;
        hit = true;
        if (match.index > last)
          children.push({ type: "text", value: value.slice(last, match.index) });
        children.push({
          type: "link",
          url: `card:${id}`,
          children: [{ type: "text", value: `#${id}` }],
        });
        last = match.index + match[0].length;
      }
      if (!hit) return;
      if (last < value.length) children.push({ type: "text", value: value.slice(last) });
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
}

export function Markdown({ body, className }: { body: string; className?: string }) {
  // Every markdown body on a page linkifies against the same set — see
  // OpenIdsProvider for why this is context rather than a prop.
  const ids = useOpenIds();
  return (
    <div className={className ? `nb-md ${className}` : "nb-md"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCardLinks(ids)]}
        urlTransform={urlTransform}
        components={{
          a({ href, children }) {
            if (href && href.startsWith("card:")) {
              const id = Number(href.slice(5));
              return (
                <Link className="nb-idlink" href={`/${id}`}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
