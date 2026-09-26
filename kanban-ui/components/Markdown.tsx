"use client";

import Link from "next/link";
import { createContext, useContext, useMemo } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import ReactMarkdown, { type Components, type ExtraProps, type Options, defaultUrlTransform } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { useCopy } from "@/i18n/use-copy";
import { memoryLinkKey } from "@/lib/memory-panel";
import { storyboardTag } from "@/lib/format/storyboard";
import { mockupBlock, type MockupSet } from "@/lib/mockup-tag";
import type { StoryboardSet } from "@/lib/storyboard";
import { useCardHref } from "./board-links";
import { Copied, useCopyText } from "./copy";
import { ExpandableImage } from "./image-preview";
import { Mockup } from "./Mockup";
import { Storyboard, StoryboardUnavailable } from "./Storyboard";
import { useOpenIds } from "./open-ids";

// react-markdown strips URLs with unknown protocols, which would drop our
// `card:<id>` scheme. Let those through; sanitize everything else as usual.
const urlTransform = (url: string) =>
  url.startsWith("card:") ? url : defaultUrlTransform(url);

// remark plugin: turn `#<number>` in PLAIN TEXT (outside links) into a card link, but only for
// ids that are still open. Because it visits mdast `text` nodes only, `#12`
// inside inline code or a fenced block (which live on `inlineCode`/`code` nodes)
// is never touched. Non-open ids are left as plain text — no dead links.
function remarkCardLinks(openIds: Set<number>) {
  // A unified plugin is an attacher `() => transformer`; the extra layer is what
  // unified calls to get the transformer. Returning the transformer directly
  // makes unified invoke it with no tree.
  return () => (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, (node: any, index: number | undefined, parent: any) => {
      // Text already inside a link stays as it is: a link within a link is invalid HTML.
      if (node.type === "link" || node.type === "linkReference") return SKIP;
      if (node.type !== "text" || index == null || !parent) return;
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

// remark plugin: turn an `<Asset src=".." label=".." />` (or the older `<Mockup>`) on a line
// of its own into what that file holds (#239, #803) — but only where mockups belong, which is a card page. A
// tag inside backticks or a fenced block is an `inlineCode`/`code` node, so it is never
// seen here; a tag anywhere mockups aren't drawn, and one written into a line of prose
// rather than on a line of its own, stays plain text. Never nothing: a card quoted in a
// memory page or a run's log still says a mockup is there and names its file.
function remarkMockups(mockups: MockupSet | null) {
  return () => (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      if (!/<(?:Asset|Mockup)\b/.test(node.value)) return;
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

// remark plugin: a `<Storyboard src=".." />` alone in its paragraph becomes the storyboard it
// names (#963), on a card page only. Anywhere else, or sharing a line, it stays text.
function remarkStoryboards(storyboards: StoryboardSet | null) {
  return () => (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent || !/<Storyboard\b/.test(node.value)) return;
      const src = storyboards && parent.type === "root" ? storyboardTag(node.value) : null;
      parent.children.splice(
        index,
        1,
        src === null
          ? { type: "text", value: node.value }
          : { type: "storyboard", data: { hName: "storyboard", hProperties: { "data-src": src }, hChildren: [] } },
      );
      return [SKIP, index + 1];
    });
  };
}

// Fenced blocks are coloured by their language tag only — an untagged block stays plain, since
// a wrong guess reads worse than none (#827). A diff is drawn by rehypeDiff instead, in the
// Diff tab's colours.
const HIGHLIGHT_OPTIONS = {
  languages: { bash, css, dockerfile, go, ini, javascript, json, markdown, python, rust, shell, sql, typescript, xml, yaml },
  plainText: ["diff"],
};

/** A ```diff block, one span per line: added, removed, or a dimmed header. */
function rehypeDiff() {
  return (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "element", (node: any, _index: number | undefined, parent: any) => {
      if (node.tagName !== "code" || parent?.tagName !== "pre") return;
      const classes: unknown[] = node.properties?.className ?? [];
      if (!classes.includes("language-diff")) return;
      const text: string = node.children.map((kid: { value?: string }) => kid.value ?? "").join("");
      node.properties.className = [...classes, "nb-diff"];
      node.children = text.split(/(?<=\n)/).map((line) => ({
        type: "element",
        tagName: "span",
        properties: { className: [diffLine(line)] },
        children: [{ type: "text", value: line }],
      }));
      return SKIP;
    });
  };
}

function diffLine(line: string): string {
  if (/^(---|\+\+\+|@@|diff |index )/.test(line)) return "nb-diff-head";
  if (line.startsWith("+")) return "nb-diff-add";
  if (line.startsWith("-")) return "nb-diff-del";
  return "nb-diff-ctx";
}

const REHYPE_PLUGINS: Options["rehypePlugins"] = [rehypeDiff, [rehypeHighlight, HIGHLIGHT_OPTIONS]];

// The mockups reach the tag handler as context, not as a closure, so the handler can be
// one component defined once. A component built inside the render is a NEW type on every
// render, and React answers a new type by throwing the old subtree away and mounting a
// fresh one — which reloads the mockup's iframe and forgets whether it was showing the
// code. The board re-renders on every run poll, so that was a mockup flashing back to
// the picture every few seconds.
const MockupsContext = createContext<MockupSet | null>(null);

// A tag remarkMockups turned into a mockup lands here, by that name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MockupNode(props: any) {
  const mockups = useContext(MockupsContext);
  const view = mockups?.[props["data-src"] as string];
  return view ? <Mockup view={view} label={props["data-label"] || ""} /> : null;
}

const StoryboardsContext = createContext<StoryboardSet | null>(null);

// A card page reads every storyboard it has on disk; one it holds none for is a page with no
// disk behind it — the hosted board.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StoryboardNode(props: any) {
  const view = useContext(StoryboardsContext)?.[props["data-src"] as string];
  return view ? <Storyboard view={view} /> : <StoryboardUnavailable />;
}

/** The memory file being drawn, so its relative `.md` links open the file they name (#959). */
export interface MemoryLinks {
  agent: string;
  /** The file's own name — `feedback/pacing` — which its links resolve against. */
  name: string;
  /** Every file that owner holds. */
  files: string[];
}

const MemoryLinksContext = createContext<MemoryLinks | null>(null);

const RELATIVE_MD = /^(?![a-z][a-z0-9+.-]*:|\/|#)[^#?]*\.md(#.*)?$/i;

function Anchor({ href, children, node }: { href?: string; children?: React.ReactNode } & ExtraProps) {
  const cardHref = useCardHref();
  const memory = useContext(MemoryLinksContext);
  // A linked picture opens the preview rather than the link — never a button inside a link.
  if (node?.children.some((kid) => kid.type === "element" && kid.tagName === "img")) return <>{children}</>;
  if (memory && href && RELATIVE_MD.test(href)) {
    const key = memoryLinkKey(href, memory.agent, memory.name, memory.files);
    // No such file: plain text rather than a link that leads nowhere.
    return key ? <Link href={`/memory/${key}`}>{children}</Link> : <>{children}</>;
  }
  if (href && href.startsWith("card:")) {
    const id = Number(href.slice(5));
    return (
      <Link className="nb-idlink" href={cardHref(id)}>
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

/** A fenced block with a copy button in its corner, for the one place a copy button
 *  belongs: a reply in the chat rail (#269). Everywhere else the same markdown is drawn
 *  without it — a card's body, a memory file and a run's log are read, not lifted. */
function CopyPre({ node, children, ...rest }: React.ComponentProps<"pre"> & ExtraProps) {
  const c = useCopy();
  const { copied, copy } = useCopyText();
  return (
    <div className="group relative">
      <pre {...rest}>{children}</pre>
      <button
        type="button"
        onClick={() => copy(codeOf(node))}
        title={c.chat.copyCode}
        aria-label={c.chat.copyCode}
        className="absolute right-2 top-2 grid size-6 cursor-pointer place-items-center rounded-[6px] bg-nb-paper text-nb-ink opacity-0 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
      </button>
      <Copied on={copied} />
    </div>
  );
}

/** What a fenced block says, off the tree rather than off the rendered children — the
 *  children are React elements, and the text is what goes on the clipboard. */
function codeOf(node: ExtraProps["node"]): string {
  let text = "";
  const walk = (n: { type: string; value?: string; children?: unknown[] }) => {
    if (n.type === "text") text += n.value ?? "";
    for (const kid of n.children ?? []) walk(kid as Parameters<typeof walk>[0]);
  };
  if (node) walk(node);
  return text;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Img({ node, ...rest }: React.ComponentProps<"img"> & ExtraProps) {
  return <ExpandableImage {...rest} />;
}

// `mockup` is our own tag rather than an HTML one, so the map is cast: what
// react-markdown looks up is the tag name, and it has no type for that one.
const COMPONENTS = { mockup: MockupNode, storyboard: StoryboardNode, a: Anchor, img: Img } as Components;

// Held apart as a constant rather than spread at render: a fresh `components` object every
// render is a fresh component type, which React answers by remounting the whole subtree.
const COMPONENTS_COPY = { ...COMPONENTS, pre: CopyPre } as Components;

export function Markdown({
  body,
  className,
  /** The mockups this page has already read, keyed by `src` (#239). Only a card page
   *  hands them over — everywhere else a `<Mockup>` tag reads as the text it is. */
  mockups,
  /** The storyboards this page has read (#963). Only a card page hands them over. */
  storyboards,
  /** Put a copy button on every fenced block (#269). Only a reply in the chat rail asks
   *  for it. */
  copyCode,
  memory,
}: {
  body: string;
  className?: string;
  mockups?: MockupSet;
  storyboards?: StoryboardSet;
  copyCode?: boolean;
  /** Set on a memory page; hold it stable across renders. */
  memory?: MemoryLinks;
}) {
  // Every markdown body on a page linkifies against the same set — see
  // OpenIdsProvider for why this is context rather than a prop.
  const ids = useOpenIds();
  // Held across renders so a poll doesn't re-parse every body on the page.
  const plugins = useMemo(
    () => [remarkGfm, remarkCardLinks(ids), remarkMockups(mockups ?? null), remarkStoryboards(storyboards ?? null)],
    [ids, mockups, storyboards],
  );
  return (
    <MockupsContext.Provider value={mockups ?? null}>
      <StoryboardsContext.Provider value={storyboards ?? null}>
      <MemoryLinksContext.Provider value={memory ?? null}>
        <div className={className ? `nb-md ${className}` : "nb-md"}>
          <ReactMarkdown
            remarkPlugins={plugins}
            rehypePlugins={REHYPE_PLUGINS}
            urlTransform={urlTransform}
            components={copyCode ? COMPONENTS_COPY : COMPONENTS}
          >
            {body}
          </ReactMarkdown>
        </div>
      </MemoryLinksContext.Provider>
      </StoryboardsContext.Provider>
    </MockupsContext.Provider>
  );
}
