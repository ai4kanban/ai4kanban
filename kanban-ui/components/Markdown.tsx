"use client";

import Link from "next/link";
import { createContext, useContext, useMemo } from "react";
import ReactMarkdown, { type Components, defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { mockupBlock, type MockupSet } from "@/lib/mockup-tag";
import { Mockup } from "./Mockup";
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

// remark plugin: turn a `<Mockup src=".." label=".." />` on a line of its own into the
// screen that file holds (#239) — but only where mockups belong, which is a card page. A
// tag inside backticks or a fenced block is an `inlineCode`/`code` node, so it is never
// seen here; a tag anywhere mockups aren't drawn, and one written into a line of prose
// rather than on a line of its own, stays plain text. Never nothing: a card quoted in a
// memory page or a run's log still says a mockup is there and names its file.
function remarkMockups(mockups: MockupSet | null) {
  return () => (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      if (!node.value.includes("<Mockup")) return;
      const tags = mockups && parent.type === "root" ? mockupBlock(node.value) : null;
      if (!tags) {
        parent.children.splice(index, 1, { type: "text", value: node.value });
        return [SKIP, index + 1];
      }
      const drawn = tags.map((tag) => ({
        type: "mockup",
        data: {
          hName: "mockup",
          hProperties: { "data-src": tag.src, "data-label": tag.label },
          hChildren: [],
        },
      }));
      parent.children.splice(index, 1, ...drawn);
      return [SKIP, index + drawn.length];
    });
  };
}

// The mockups reach the tag handler as context, not as a closure, so the handler can be
// one component defined once. A component built inside the render is a NEW type on every
// render, and React answers a new type by throwing the old subtree away and mounting a
// fresh one — which reloads the mockup's iframe and forgets whether it was showing the
// code. The board re-renders on every session poll, so that was a mockup flashing back to
// the picture every few seconds.
const MockupsContext = createContext<MockupSet | null>(null);

// A tag remarkMockups turned into a mockup lands here, by that name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MockupNode(props: any) {
  const mockups = useContext(MockupsContext);
  const view = mockups?.[props["data-src"] as string];
  return view ? <Mockup view={view} label={props["data-label"] || ""} /> : null;
}

function Anchor({ href, children }: { href?: string; children?: React.ReactNode }) {
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
}

// `mockup` is our own tag rather than an HTML one, so the map is cast: what
// react-markdown looks up is the tag name, and it has no type for that one.
const COMPONENTS = { mockup: MockupNode, a: Anchor } as Components;

export function Markdown({
  body,
  className,
  /** The mockups this page has already read, keyed by `src` (#239). Only a card page
   *  hands them over — everywhere else a `<Mockup>` tag reads as the text it is. */
  mockups,
}: {
  body: string;
  className?: string;
  mockups?: MockupSet;
}) {
  // Every markdown body on a page linkifies against the same set — see
  // OpenIdsProvider for why this is context rather than a prop.
  const ids = useOpenIds();
  // Held across renders so a poll doesn't re-parse every body on the page.
  const plugins = useMemo(
    () => [remarkGfm, remarkCardLinks(ids), remarkMockups(mockups ?? null)],
    [ids, mockups],
  );
  return (
    <MockupsContext.Provider value={mockups ?? null}>
      <div className={className ? `nb-md ${className}` : "nb-md"}>
        <ReactMarkdown remarkPlugins={plugins} urlTransform={urlTransform} components={COMPONENTS}>
          {body}
        </ReactMarkdown>
      </div>
    </MockupsContext.Provider>
  );
}
