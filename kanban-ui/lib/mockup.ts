// Turn a card's `<Asset>` tag (`<Mockup>` before #803) into what the file holds (#239).
//
// Assets sit in this board's own folder on the machine, under `assets/<card id>/` — or
// `mockups/<card id>/` (#590) and the board's `.mockups/` for older cards — and the tag names
// one file in it. It is drawn here with nothing fetched and nothing installed:
//
//   .tsx   a React component, styled with Tailwind. It may import the files beside it in
//          its own folder (#661), so a mockup is a copy of the real screen's files with the
//          wiring taken out rather than a lookalike written from scratch. Transpiled, run
//          once to draw itself, and turned into markup. The stylesheet is the one the
//          folder carries — copy the app's own in and the drawing wears the app's theme.
//   .html  a whole page already — taken as it is.
//   .txt   a drawing in plain text (#256). Nothing is run and nothing is styled: the frame
//          shows the file's own characters in a monospaced block.
//   image  .png .jpg .jpeg .webp .gif .svg (#803). Not read here: the page loads its bytes
//          from app/asset-image, and an `<img>` never runs what an SVG holds.
//   media  .mp4 .webm .mov, .mp3 .wav .m4a (#872). Not read here either: the page's own
//          player streams them from app/asset-image.
//
// For the first two what comes back is one self-contained HTML document. The frame shows it
// in a sandboxed iframe, so nothing in it runs, nothing reaches the network, and its styling
// and the board's never meet.

import type { MessagesCopy } from "@/i18n/messages/types";
import { machineCopy } from "./language";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
// `react-dom/server` is not importable from a server component — Next replaces it with a
// module that throws. The browser build is the same renderer and comes through untouched,
// which also keeps one React in play: the mockup, this render and the board all share it.
import { renderToStaticMarkup } from "react-dom/server.browser";
import { transform } from "sucrase";
import { compile } from "tailwindcss";
import type { MockupSet, MockupView } from "./mockup-tag";
import { assetImageHref, mockupSources } from "./mockup-tag";
import { AUDIO_TYPES, findIn, IMAGE_TYPES, SEGMENT, VIDEO_TYPES } from "./asset-bytes";
import { assetsDir, mockupsDir } from "./cli";
import { kanbanDir } from "./paths";
import { hyperframeDocument } from "./hyperframe-document";

const IMAGE_EXTS = Object.keys(IMAGE_TYPES);
const MEDIA_EXTS: Record<string, "video" | "audio"> = {
  ...Object.fromEntries(Object.keys(VIDEO_TYPES).map((e) => [e, "video" as const])),
  ...Object.fromEntries(Object.keys(AUDIO_TYPES).map((e) => [e, "audio" as const])),
};
const EXTS = ["tsx", "html", "txt", ...IMAGE_EXTS, ...Object.keys(MEDIA_EXTS)];

/** `.assets/<folder>/<file>.<ext>`, or `.mockups/...` / `mockups/...` on older cards, and
 *  nothing else — no `.`, no `..`, nothing that climbs. An asset is read off the user's disk,
 *  so the only files we open are the ones in a card's asset folder. */
const SRC = new RegExp(
  `^(?:\\.assets|\\.?mockups)/(?!\\.{1,2}/)([^/\\\\]+)/(?!\\.)([^/\\\\]+)\\.(${EXTS.join("|")})$`,
  "i",
);

/** A file in a card's asset folder: this machine's `assets/`, then the older `mockups/`, then
 *  the board's `.mockups/`. `null` when it is in none of them, or the names try to climb. */
export async function assetFile(folder: string, name: string): Promise<string | null> {
  return findIn(await assetRoots(), folder, name);
}

export async function assetRoots(): Promise<string[]> {
  return [...new Set([await assetsDir(), await mockupsDir(), path.join(kanbanDir(), ".mockups")])];
}

/** How long a mockup gets to load and to draw itself, all its files together. Generous for
 *  a drawing, short enough that a runaway one is a note rather than a hang. */
const DRAW_MS = 5000;

/** How many files one mockup may pull in. A copied screen is a handful; a number this far
 *  above it only ever catches a folder that was copied wholesale by mistake. */
const MAX_FILES = 60;

/** What a file beside the entry may be called when the import leaves the extension off. */
const CODE_EXTS = [".tsx", ".ts", ".jsx", ".js", ".mjs"];

/** Every module id the transpiled source asks for. Sucrase turns every `import` and every
 *  `export ... from` into one of these, so reading the output is exact where reading the
 *  source would be a guess. */
const REQUIRES = /require\(\s*["']([^"']+)["']\s*\)/g;

const REACT_IDS = new Set(["react", "react/jsx-runtime", "react/jsx-dev-runtime"]);

// --- what a copy may keep importing ------------------------------------------
//
// Everything here draws or names something on the screen, so taking it out of a copied
// component would change the picture. Anything that loads data, talks to a service or
// answers a click is not here: that is what the designer trims out of the copy.

const NOTHING = () => {};

/** `next/link` and `next/image` draw an anchor and an image — the props that only mean
 *  something to a running app are dropped, since nothing in a mockup navigates or loads. */
const NEXT_LINK = {
  __esModule: true,
  default: function Link({ href, children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) {
    const { prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, ...attrs } = rest;
    void [prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior];
    return React.createElement("a", { href: typeof href === "string" ? href : "#", ...attrs }, children);
  },
};

const NEXT_IMAGE = {
  __esModule: true,
  default: function Image({ src, alt, ...rest }: Record<string, unknown>) {
    const { fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, sizes, ...attrs } = rest;
    void [fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, sizes];
    const url = typeof src === "string" ? src : ((src as { src?: string } | null)?.src ?? "");
    return React.createElement("img", { src: url, alt: typeof alt === "string" ? alt : "", ...attrs });
  },
};

/** Navigation with nowhere to go. A copied component often reads the address to decide which
 *  row looks selected, which is part of the picture; the rest of the router does nothing. */
const NEXT_NAVIGATION = {
  __esModule: true,
  useRouter: () => ({ push: NOTHING, replace: NOTHING, back: NOTHING, forward: NOTHING, refresh: NOTHING, prefetch: NOTHING }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
  redirect: NOTHING,
  notFound: NOTHING,
};

/** The icon sets a copy may keep, loaded only when one asks for it — the whole of `si` is
 *  five megabytes, and a mockup that draws no brand logo should never pay for it. */
const ICON_SETS: Record<string, () => Promise<unknown>> = {
  fi: () => import("react-icons/fi"),
  fa: () => import("react-icons/fa"),
  si: () => import("react-icons/si"),
};

/** The rest: class-name helpers, which decide what a copied component's `className` reads
 *  as and so decide how it looks. */
const HELPERS: Record<string, () => Promise<unknown>> = {
  clsx: () => import("clsx"),
  "tailwind-merge": () => import("tailwind-merge"),
  "class-variance-authority": () => import("class-variance-authority"),
};

/** One package a copy kept, ready to hand to the sandbox. Throws when the id is something a
 *  mockup has to do without. */
async function loadPackage(id: string, c: MessagesCopy["mockup"]): Promise<unknown> {
  if (REACT_IDS.has(id)) return React;
  if (id === "next/link") return NEXT_LINK;
  if (id === "next/image") return NEXT_IMAGE;
  if (id === "next/navigation") return NEXT_NAVIGATION;
  const set = /^react-icons\/([a-z0-9]+)$/.exec(id);
  const load = set ? ICON_SETS[set[1]!] : HELPERS[id];
  if (!load) throw new Error(c.cannotImport(id));
  // A real module namespace is frozen and carries no `__esModule`, so the sandbox's own
  // interop would hand `import x from "clsx"` the namespace instead of the function. A flat
  // copy of it, marked, is what a `require` is expected to answer with.
  return { __esModule: true, ...((await load()) as Record<string, unknown>) };
}

/** Read and draw every mockup a card body points at. One note in place of one mockup
 *  leaves the rest of the card as usual, so a failure is a value here, never a throw. */
export async function readMockups(body: string): Promise<MockupSet> {
  const set: MockupSet = {};
  for (const src of mockupSources(body)) set[src] = await readMockup(src);
  return set;
}

/** One mockup, drawn. `contain` is false on the mockup's own page, where the page is what
 *  scrolls and the frame must let the scroll through (see `frameCss`). */
export async function readMockup(src: string, contain = true): Promise<MockupView> {
  // Read once at the door and handed down: everything below it is sync or deep in a
  // sandbox, and neither can wait on the language.
  const c = (await machineCopy()).messages.mockup;
  const match = SRC.exec(src);
  if (!match) {
    return { src, error: c.notAMockup(src, EXTS.map((e) => `.${e}`).join(" ")) };
  }
  const [, folder, name, rawExt] = match;
  const ext = rawExt!.toLowerCase();
  const fileName = `${name}.${rawExt}`;
  if (!SEGMENT.test(folder!) || !SEGMENT.test(fileName)) return { src, error: c.outside(src) };
  let file: string | null;
  try {
    file = await assetFile(folder!, fileName);
  } catch {
    // No rules to ask where the assets are. A note, not a throw: this page has one job.
    file = null;
  }
  if (!file) return { src, error: c.missing(src) };
  const media = MEDIA_EXTS[ext];
  if (IMAGE_EXTS.includes(ext) || media) {
    // The mtime makes a redrawn file a new address, so the page never shows a stale one.
    const version = Math.floor(fs.statSync(file).mtimeMs);
    const href = `${assetImageHref(folder!, fileName)}?v=${version}`;
    return media ? { src, media: { kind: media, href } } : { src, image: href };
  }
  let code: string;
  try {
    code = fs.readFileSync(file, "utf8");
  } catch {
    return { src, error: c.missing(src) };
  }
  // A `.txt` mockup is the drawing itself (#256) — nothing to transpile, nothing to style,
  // and so nothing that can fail once the file has been read.
  if (ext === "txt") return { src, text: code };
  try {
    if (ext === "html" && fileName.endsWith(".hf.html")) {
      return { src, code, doc: hyperframeDocument(code), hyperframe: true };
    }
    const doc = ext === "tsx" ? await drawComponent(file, src, contain, c) : dressPage(code, contain);
    return { src, code, doc };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { src, code, error: c.notDrawn(src, why) };
  }
}

// --- .tsx --------------------------------------------------------------------

/** A mockup's files, read and transpiled, with every import already resolved. Gathering
 *  this first is what lets a package be fetched — `import()` is a promise, and the sandbox
 *  below it is all synchronous. */
type Graph = {
  /** Transpiled source, by absolute path. */
  code: Map<string, string>;
  /** Per file, what each of its import ids points at on disk. */
  links: Map<string, Map<string, string>>;
  /** The stylesheets the graph imports, in the order they were reached. */
  sheets: { path: string; content: string }[];
  /** The packages it kept, already loaded. */
  packages: Map<string, unknown>;
};

/** Walk the entry's imports, reading and transpiling as it goes. Files are looked for beside
 *  the entry and nowhere else: a mockup is a snapshot, so everything it needs sits in its own
 *  folder and moves with it. */
async function readGraph(entry: string, folder: string, c: MessagesCopy["mockup"]): Promise<Graph> {
  const graph: Graph = { code: new Map(), links: new Map(), sheets: [], packages: new Map() };
  const styled = new Set<string>();

  const walk = async (file: string): Promise<void> => {
    if (graph.code.has(file)) return;
    if (graph.code.size >= MAX_FILES) throw new Error(c.tooManyFiles(MAX_FILES));
    const js = transform(fs.readFileSync(file, "utf8"), {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      filePath: file,
    }).code;
    graph.code.set(file, js);
    const link = new Map<string, string>();
    graph.links.set(file, link);
    for (const found of js.matchAll(REQUIRES)) {
      const id = found[1]!;
      if (!id.startsWith(".")) {
        if (!graph.packages.has(id)) graph.packages.set(id, await loadPackage(id, c));
        continue;
      }
      const target = resolveFile(id, file, folder, c);
      link.set(id, target);
      if (target.endsWith(".css")) {
        if (styled.has(target)) continue;
        styled.add(target);
        graph.sheets.push({ path: target, content: fs.readFileSync(target, "utf8") });
        continue;
      }
      await walk(target);
    }
  };

  await walk(entry);
  return graph;
}

/** Where a relative import lands. The extension may be left off the way the app writes it,
 *  and a folder means its `index`. */
function resolveFile(id: string, from: string, folder: string, c: MessagesCopy["mockup"]): string {
  const at = path.resolve(path.dirname(from), id);
  if (at !== folder && !at.startsWith(folder + path.sep)) throw new Error(c.outsideFolder(id));
  const tries = path.extname(at)
    ? [at]
    : [...CODE_EXTS.map((e) => at + e), ...CODE_EXTS.map((e) => path.join(at, `index${e}`))];
  for (const file of tries) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  throw new Error(c.noSuchFile(id));
}

async function drawComponent(entry: string, src: string, contain: boolean, c: MessagesCopy["mockup"]): Promise<string> {
  const folder = path.dirname(entry);
  const graph = await readGraph(entry, folder, c);

  // A bare context: no `process`, no `fetch`, no board, no files — only React, the packages
  // the copy kept, and the files beside it. A mockup runs to draw itself and for nothing
  // else, and the whole of it runs under one clock, so a mockup that never finishes is a
  // note on the card rather than a board that stops answering.
  const sandbox: Record<string, unknown> = {
    React,
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  };
  const context = vm.createContext(sandbox);
  const deadline = Date.now() + DRAW_MS;

  const modules = new Map<string, { exports: Record<string, unknown> }>();
  const order: string[] = [];
  sandbox.__bind = (n: number) => {
    const file = order[n]!;
    const mod = modules.get(file)!;
    return {
      module: mod,
      exports: mod.exports,
      require: (id: string) => {
        const target = graph.links.get(file)?.get(id);
        // A stylesheet is already in the document; the import is only how it got there.
        if (target) return target.endsWith(".css") ? {} : load(target);
        if (graph.packages.has(id)) return graph.packages.get(id);
        throw new Error(c.cannotImport(id));
      },
    };
  };

  const load = (file: string): Record<string, unknown> => {
    const done = modules.get(file);
    if (done) return done.exports;
    const mod = { exports: {} as Record<string, unknown> };
    modules.set(file, mod);
    const n = order.push(file) - 1;
    // `__b` is read into the call's arguments before the body runs, so a file this one
    // imports can reassign it without ever reaching the arguments already passed.
    const script = `var __b = __bind(${n});\n(function (module, exports, require) {\n${graph.code.get(file)!}\n})(__b.module, __b.exports, __b.require)`;
    run(script, context, file, deadline, c);
    return mod.exports;
  };

  const Component = load(entry).default;
  if (typeof Component !== "function") {
    throw new Error(c.noDefault);
  }
  sandbox.__draw = () =>
    renderToStaticMarkup(React.createElement(Component as React.FunctionComponent));
  const markup = run("__draw()", context, src, deadline, c) as string;
  return page(await tailwindFor(markup, graph.sheets, c), markup, contain);
}

/** One turn inside the sandbox, on what is left of the clock. Whatever comes back out is a
 *  sentence the note on the card can end with. */
function run(
  script: string,
  context: vm.Context,
  src: string,
  deadline: number,
  c: MessagesCopy["mockup"],
): unknown {
  const left = deadline - Date.now();
  if (left <= 0) throw new Error(c.tooSlow(DRAW_MS / 1000));
  try {
    return vm.runInContext(script, context, { timeout: left, filename: src });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    if (/timed out/i.test(why)) {
      throw new Error(c.tooSlow(DRAW_MS / 1000));
    }
    throw new Error(why.replace(/^Error:\s*/, ""));
  }
}

// --- Tailwind ----------------------------------------------------------------

/** `@import "tailwindcss"` resolves to one self-contained file — the theme, the reset and
 *  the utilities. Read once; the compiler is what gets built per mockup. */
let baseCss: { path: string; css: string } | null = null;

function tailwindBase(c: MessagesCopy["mockup"]): { path: string; css: string } {
  if (baseCss) return baseCss;
  const file = findTailwindCss(c);
  baseCss = { path: file, css: fs.readFileSync(file, "utf8") };
  return baseCss;
}

/** Tailwind's own stylesheet is a file, not code, so it is found rather than imported —
 *  in node_modules beside the built app, or beside where the app was started. Looked for
 *  by walking up, because the bundler rewrites every other way of asking. */
function findTailwindCss(c: MessagesCopy["mockup"]): string {
  const starts = [process.cwd()];
  try {
    starts.push(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    // A bundled chunk whose URL says nothing useful — the working directory is enough.
  }
  for (const start of starts) {
    let dir = start;
    for (let up = 0; up < 10; up++) {
      const hit = path.join(dir, "node_modules", "tailwindcss", "index.css");
      if (fs.existsSync(hit)) return hit;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(c.noStylesheet);
}

const CLASS_ATTR = /class="([^"]*)"/g;

/** The styling this markup asks for, worked out now rather than when the app was built —
 *  which is what makes every Tailwind class work, including the ones the board's own
 *  screens never use.
 *
 *  The stylesheets are the mockup's own, in the order it imported them: copy the app's
 *  `globals.css` into the folder and the drawing gets the app's tokens, its utilities and
 *  its base rules, which is how a copied component keeps looking like itself. A mockup that
 *  imports none gets plain Tailwind, as every one did before (#661). */
async function tailwindFor(
  markup: string,
  sheets: { path: string; content: string }[],
  c: MessagesCopy["mockup"],
): Promise<string> {
  const { path: file, css } = tailwindBase(c);
  const tailwind = { path: file, base: path.dirname(file), content: css };
  const source = sheets.length ? sheets.map((s) => s.content).join("\n") : '@import "tailwindcss";';
  const compiler = await compile(source, {
    base: sheets.length ? path.dirname(sheets[0]!.path) : tailwind.base,
    loadStylesheet: async (id: string, from: string) => {
      if (id === "tailwindcss" || id.startsWith("tailwindcss/")) return tailwind;
      if (!id.startsWith(".")) throw new Error(c.cannotImport(id));
      const at = path.resolve(from, id);
      return { path: at, base: path.dirname(at), content: fs.readFileSync(at, "utf8") };
    },
  });
  const classes = [...markup.matchAll(CLASS_ATTR)].flatMap((m) => m[1]!.split(/\s+/));
  return compiler.build(classes.filter(Boolean));
}

// --- the document ------------------------------------------------------------

// Only embedded assets load; scripts and network requests stay blocked.
const CSP =
  "<meta http-equiv=\"Content-Security-Policy\" " +
  "content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:\">";

// Sideways is the one direction a mockup never scrolls: a layout that runs off the side is
// one the user never sees whole. Up and down it scrolls inside its own frame.
//
// Where that scroll goes when the frame has no more to give is `contain`, and it is the
// whole difference between the two places a mockup is shown. On a card page it stops at
// the frame: a wheel over a picture must not move the card behind it. On the mockup's own
// page the frame IS what the user came for, it is drawn at full size in a panel smaller
// than it, and that panel is what scrolls — so containing the scroll there leaves a
// picture whose edges cannot be reached at all.
function frameCss(contain: boolean): string {
  return `<style>html{overflow-x:hidden${contain ? ";overscroll-behavior:contain" : ""}}</style>`;
}

const head = (contain: boolean) => `<meta charset="utf-8">${CSP}${frameCss(contain)}`;

function page(css: string, markup: string, contain: boolean): string {
  return `<!doctype html><html><head>${head(contain)}<style>${css}</style></head><body>${markup}</body></html>`;
}

/** An `.html` mockup is a whole page already — it keeps its own markup and its own
 *  styling, and only gets the frame's own two rules put in front of them. */
function dressPage(html: string, contain: boolean): string {
  const HEAD = head(contain);
  const found = /<head[^>]*>/i.exec(html);
  if (found) return html.slice(0, found.index + found[0].length) + HEAD + html.slice(found.index + found[0].length);
  const open = /<html[^>]*>/i.exec(html);
  if (open) return html.slice(0, open.index + open[0].length) + `<head>${HEAD}</head>` + html.slice(open.index + open[0].length);
  return `<!doctype html><html><head>${HEAD}</head><body>${html}</body></html>`;
}
