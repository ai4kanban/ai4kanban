// Copied from legacy kanban-ui/components/Markdown.tsx. Kept: react-markdown with GFM, the
// highlighted fences and the diff colours, and the tags a card page draws in place — `<Asset>`
// (and `<Mockup>`), `<Storyboard>` and `<Compare>`. Changed: every tag reaches its artifact
// through the page's `Previews`; card links go wherever the page's `cardLink` says, and every
// fenced block has a copy button. Trimmed: memory and test case files and articles' relative
// pictures.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import ReactMarkdown, { defaultUrlTransform, type Components, type ExtraProps, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import type { Previews } from "../lib/artifacts";
import { compareTag } from "../lib/format/compare";
import { storyboardAttrs } from "../lib/format/storyboard";
import { deviceOf, mockupBlock, type MockupView, type Variant } from "../lib/mockup-tag";
import { useCopy } from "../i18n";
import { DeferredCompare } from "./Compare";
import { Copied, useCopyText } from "./copy";
import { ExpandableImage } from "./image-preview";
import { MermaidDiagram } from "./MermaidDiagram";
import { Mockup, Note } from "./Mockup";
import { DeferredStoryboard } from "./Storyboard";

/** What a `#12` in a body becomes: a link, or null to leave it as text. */
export type CardLink = (id: number, text: ReactNode) => ReactNode | null;

// react-markdown drops URLs with unknown protocols, which would drop `card:<id>`.
const urlTransform = (url: string) => (url.startsWith("card:") ? url : defaultUrlTransform(url));

// remark plugin: `#<number>` in plain text becomes a `card:<id>` link. Inline code, fenced blocks
// and text already inside a link are other node types, so they are never touched.
function remarkCardLinks(on: boolean) {
  return () => (tree: unknown) => {
    if (!on) return;
    visit(tree as any, (node: any, index: number | undefined, parent: any) => {
      if (node.type === "link" || node.type === "linkReference") return SKIP;
      if (node.type !== "text" || index == null || !parent) return;
      const value: string = node.value;
      const children: unknown[] = [];
      let last = 0;
      for (const match of value.matchAll(/#(\d+)/g)) {
        if (match.index > last) children.push({ type: "text", value: value.slice(last, match.index) });
        children.push({ type: "link", url: `card:${match[1]}`, children: [{ type: "text", value: match[0] }] });
        last = match.index + match[0].length;
      }
      if (!children.length) return;
      if (last < value.length) children.push({ type: "text", value: value.slice(last) });
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
}

// remark plugin: an `<Asset src=".." label=".." />` (or the older `<Mockup>`) on a line of its
// own becomes what its artifact holds (#239, #803) — only where previews are drawn. A tag inside
// backticks or a fenced block is never seen here; one anywhere else stays plain text.
function remarkMockups(on: boolean) {
  return () => (tree: unknown) => {
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent) return;
      if (!/<(?:Asset|Mockup)\b/.test(node.value)) return;
      const tags = on && parent.type === "root" ? mockupBlock(node.value) : null;
      if (!tags) {
        parent.children.splice(index, 1, { type: "text", value: node.value });
        return [SKIP, index + 1];
      }
      const drawn = tags.map((tag) => ({
        type: "mockup",
        data: {
          hName: "mockup",
          hProperties: { "data-src": tag.src, "data-label": tag.label, "data-alt": tag.alt, "data-device": tag.device, "data-loop": String(tag.loop), "data-variants": JSON.stringify(tag.variants) },
          hChildren: [],
        },
      }));
      parent.children.splice(index, 1, ...drawn);
      return [SKIP, index + drawn.length];
    });
  };
}

// remark plugin: a `<Storyboard src=".." />` alone in its paragraph becomes the storyboard it
// names (#963). Anywhere else, or sharing a line, it stays text.
function remarkStoryboards(on: boolean) {
  return () => (tree: unknown) => {
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent || !/<Storyboard\b/.test(node.value)) return;
      const tag = on && parent.type === "root" ? storyboardAttrs(node.value) : null;
      parent.children.splice(
        index,
        1,
        tag === null
          ? { type: "text", value: node.value }
          : { type: "storyboard", data: { hName: "storyboard", hProperties: { "data-src": tag.src, "data-label": tag.label }, hChildren: [] } },
      );
      return [SKIP, index + 1];
    });
  };
}

// remark plugin: a `<Compare a=".." b=".." />` alone in its paragraph becomes the two files side
// by side (#1740). Anywhere else, or sharing a line, it stays text.
function remarkCompares(on: boolean) {
  return () => (tree: unknown) => {
    visit(tree as any, "html", (node: any, index: number | undefined, parent: any) => {
      if (index == null || !parent || !/<Compare\b/.test(node.value)) return;
      const tag = on && parent.type === "root" ? compareTag(node.value) : null;
      parent.children.splice(
        index,
        1,
        tag === null
          ? { type: "text", value: node.value }
          : {
              type: "compare",
              data: {
                hName: "compare",
                hProperties: { "data-a": tag.a, "data-b": tag.b, "data-label": tag.label, "data-a-label": tag.aLabel, "data-b-label": tag.bLabel, "data-shots": tag.shots },
                hChildren: [],
              },
            },
      );
      return [SKIP, index + 1];
    });
  };
}

// Fenced blocks are coloured by their language tag only — an untagged block stays plain (#827).
// A diff is drawn by rehypeDiff instead.
const HIGHLIGHT_OPTIONS = {
  languages: { bash, css, go, javascript, json, markdown, python, shell, sql, typescript, xml, yaml },
  plainText: ["diff"],
};

/** A ```diff block, one span per line: added, removed, or a dimmed header. */
function rehypeDiff() {
  return (tree: unknown) => {
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

// The previews reach the tag handlers as context, not as a closure, so each handler is one
// component defined once: a component built inside the render is a new type every render,
// which would remount the preview's iframe on every poll.
const PreviewsContext = createContext<Previews | null>(null);
const CardLinkContext = createContext<CardLink | null>(null);

function MockupNode(props: any) {
  const previews = useContext(PreviewsContext);
  const src = props["data-src"] as string;
  const raw = props["data-variants"] as string | undefined;
  const label = (props["data-label"] as string) || "";
  const views = useMemo(() => {
    const variants: Variant[] = raw ? JSON.parse(raw) : [];
    const list = variants.length ? variants : [{ label: "", src }];
    return previews ? list.map((v) => ({ label: v.label, view: previews.viewOfSrc(v.src, label) })) : [];
  }, [previews, raw, src, label]);
  if (!views.length) return null;
  const first = Math.max(0, views.findIndex((v) => v.view.src === src));
  const view = views[first]!.view;
  if (view.storyboard) return <DeferredStoryboard load={view.storyboard} label={label || undefined} />;
  if (view.compare) return <DeferredCompare spec={view.compare} />;
  return <Mockup views={views} first={first} label={label} alt={props["data-alt"] || ""} device={deviceOf(props["data-device"])} loop={props["data-loop"] === "true"} />;
}

/** One artifact on its own, named by itself — for the previews the body does not name. */
export function PreviewOf({ view }: { view: MockupView }) {
  const views = useMemo(() => [{ label: "", view }], [view]);
  if (view.storyboard) return <DeferredStoryboard load={view.storyboard} label={view.src} />;
  if (view.compare) return <DeferredCompare spec={view.compare} />;
  return <Mockup views={views} label={view.src} device="desktop" />;
}

function CompareNode(props: any) {
  const previews = useContext(PreviewsContext);
  const a = props["data-a"] as string;
  const b = props["data-b"] as string;
  const shots = (props["data-shots"] as string) || "";
  const label = (props["data-label"] as string) || "";
  const aLabel = (props["data-a-label"] as string) || "";
  const bLabel = (props["data-b-label"] as string) || "";
  const tag = useMemo(() => ({ a, b, shots, label, aLabel, bLabel }), [a, b, shots, label, aLabel, bLabel]);
  const spec = useMemo(() => previews?.compareOfTag(tag), [previews, tag]);
  if (!previews || !spec) return null;
  for (const side of [tag.a, tag.b]) if (!previews.refOfSrc(side)) return <Note text={previews.missing(side).error!} />;
  return <DeferredCompare spec={spec} />;
}

function StoryboardNode(props: any) {
  const previews = useContext(PreviewsContext);
  const src = props["data-src"] as string;
  const label = (props["data-label"] as string | undefined) || undefined;
  const view = useMemo(() => previews?.viewOfSrc(src, label), [previews, src, label]);
  if (!view) return null;
  if (view.error !== undefined) return <Note text={view.error} />;
  return view.storyboard ? <DeferredStoryboard load={view.storyboard} label={label} /> : <Note text={previews!.missing(src, label).error!} />;
}

function Anchor({ href, children }: { href?: string; children?: React.ReactNode } & ExtraProps) {
  const cardLink = useContext(CardLinkContext);
  if (href?.startsWith("card:")) return cardLink?.(Number(href.slice(5)), children) ?? children;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** What a fenced block says, off the tree rather than the rendered children. */
function codeOf(node: ExtraProps["node"]): string {
  let text = "";
  const walk = (n: { type: string; value?: string; children?: unknown[] }) => {
    if (n.type === "text") text += n.value ?? "";
    for (const kid of n.children ?? []) walk(kid as Parameters<typeof walk>[0]);
  };
  if (node) walk(node);
  return text;
}

/** A fenced block with a copy button in its corner: shown on hover, always on touch. */
function CopyPre({ node, ...rest }: React.ComponentProps<"pre"> & ExtraProps) {
  const c = useCopy().shared;
  const { copied, copy } = useCopyText();
  return (
    <div className="group relative">
      <pre {...rest} />
      <button
        type="button"
        onClick={() => copy(codeOf(node))}
        title={c.copyCode}
        aria-label={c.copyCode}
        className="absolute right-2 top-2 grid size-6 cursor-pointer place-items-center rounded-[6px] bg-nb-paper text-nb-ink opacity-0 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
      </button>
      <Copied on={copied} />
    </div>
  );
}

/** A ```mermaid block is drawn as its diagram (#1612); every other block as written. */
function Pre(props: React.ComponentProps<"pre"> & ExtraProps) {
  const code = props.node?.children[0];
  const classes = code?.type === "element" ? code.properties.className : undefined;
  const pre = <CopyPre {...props} />;
  if (!Array.isArray(classes) || !classes.includes("language-mermaid")) return pre;
  return <MermaidDiagram code={codeOf(props.node)} fallback={pre} />;
}

function Img({ node, ...rest }: React.ComponentProps<"img"> & ExtraProps) {
  return <ExpandableImage {...rest} />;
}

const COMPONENTS = { mockup: MockupNode, compare: CompareNode, storyboard: StoryboardNode, a: Anchor, img: Img, pre: Pre } as Components;

export function Markdown({
  body,
  className,
  /** The review's previews. Only the card body hands them over — anywhere else a tag reads
   *  as the text it is. */
  previews,
  /** Where a `#12` goes. Without it every `#12` stays text. */
  cardLink,
}: {
  body: string;
  className?: string;
  previews?: Previews;
  cardLink?: CardLink;
}) {
  const on = !!previews;
  const links = !!cardLink;
  const plugins = useMemo(() => [remarkGfm, remarkCardLinks(links), remarkMockups(on), remarkStoryboards(on), remarkCompares(on)], [on, links]);
  return (
    <PreviewsContext.Provider value={previews ?? null}>
      <CardLinkContext.Provider value={cardLink ?? null}>
        <div className={className ? `nb-md ${className}` : "nb-md"}>
          <ReactMarkdown remarkPlugins={plugins} rehypePlugins={REHYPE_PLUGINS} urlTransform={urlTransform} components={COMPONENTS}>
            {body}
          </ReactMarkdown>
        </div>
      </CardLinkContext.Provider>
    </PreviewsContext.Provider>
  );
}
