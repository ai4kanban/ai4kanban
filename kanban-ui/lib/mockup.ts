// Turn a card's `<Mockup>` tag into a picture of the screen (#239).
//
// A mockup is one file under `docs/kanban/.mockups/<card id>/`, and it is drawn here, on
// this machine, with nothing fetched and nothing installed:
//
//   .tsx   one React component, styled with Tailwind. Transpiled, run once to draw
//          itself, and turned into markup. The Tailwind it used is worked out from that
//          markup right then, so a class the board's own screens never use still works.
//   .html  a whole page already — taken as it is.
//   .txt   a drawing in plain text (#256). Nothing is run and nothing is styled: the frame
//          shows the file's own characters in a monospaced block.
//
// For the first two what comes back is one self-contained HTML document. The frame shows it
// in a sandboxed iframe, so nothing in it runs, nothing reaches the network, and its styling
// and the board's never meet.

import { copy } from "@/i18n";
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
import { mockupSources } from "./mockup-tag";
import { mockupsDir } from "./paths";

/** `.mockups/<folder>/<file>.tsx|html|txt`, and nothing else — no `.`, no `..`, nothing that
 *  climbs. A mockup is read off the user's disk, so the only files we open are the drawings
 *  in the mockups folder. The leading dot is optional: cards written before the folder was
 *  dotted point at `mockups/...`, and they still name the same file. */
const SRC = /^\.?mockups\/(?!\.{1,2}\/)([^/\\]+)\/(?!\.)([^/\\]+)\.(tsx|html|txt)$/;

/** What a `.tsx` mockup may import. Anything else is a mockup the board can't draw: a
 *  board component would follow the board's own code, and a package isn't there to load —
 *  the app bundles what it uses when it is built. */
const REACT_IDS = new Set(["react", "react/jsx-runtime", "react/jsx-dev-runtime"]);

/** How long a mockup gets to load and to draw itself. Generous for a drawing, short enough
 *  that a runaway one is a note rather than a hang. */
const DRAW_MS = 3000;

const IMPORTS =
  /(?:^|[\s;}])import\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

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
  const match = SRC.exec(src);
  if (!match) {
    return {
      src,
      error: copy.messages.mockup.notAMockup(src),
    };
  }
  const [, folder, name, ext] = match;
  const root = mockupsDir();
  const file = path.join(root, folder!, `${name}.${ext}`);
  // The regex already refuses a path that climbs; this is the check that answers for it.
  if (!file.startsWith(root + path.sep)) {
    return { src, error: copy.messages.mockup.outside(src) };
  }
  let code: string;
  try {
    code = fs.readFileSync(file, "utf8");
  } catch {
    // Mockups are not in git, so a card pulled from someone else's board points at
    // drawings this machine never made. Nothing is broken — the card still reads.
    return { src, error: copy.messages.mockup.missing(src) };
  }
  // A `.txt` mockup is the drawing itself (#256) — nothing to transpile, nothing to style,
  // and so nothing that can fail once the file has been read.
  if (ext === "txt") return { src, text: code };
  try {
    const doc = ext === "tsx" ? await drawComponent(code, src, contain) : dressPage(code, contain);
    return { src, code, doc };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { src, code, error: copy.messages.mockup.notDrawn(src, why) };
  }
}

// --- .tsx --------------------------------------------------------------------

async function drawComponent(code: string, src: string, contain: boolean): Promise<string> {
  for (const found of code.matchAll(IMPORTS)) {
    const id = (found[1] ?? found[2])!;
    if (!REACT_IDS.has(id)) {
      throw new Error(copy.messages.mockup.importsOther(id));
    }
  }

  const js = transform(code, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "classic",
    filePath: src,
  }).code;

  // A bare context: no `process`, no `fetch`, no board, no files — only React and the
  // module it is being loaded as. A mockup runs to draw itself and for nothing else, and
  // both the loading and the drawing run under a clock, so a mockup that never finishes
  // is a note on the card rather than a board that stops answering.
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const sandbox: Record<string, unknown> = {
    React,
    module: mod,
    exports: mod.exports,
    require: (id: string) => {
      if (REACT_IDS.has(id)) return React;
      throw new Error(copy.messages.mockup.cannotImport(id));
    },
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  };
  const context = vm.createContext(sandbox);
  run(js, context, src);

  const Component = mod.exports.default;
  if (typeof Component !== "function") {
    throw new Error(copy.messages.mockup.noDefault);
  }
  sandbox.__draw = () =>
    renderToStaticMarkup(React.createElement(Component as React.FunctionComponent));
  const markup = run("__draw()", context, src) as string;
  return page(await tailwindFor(markup), markup, contain);
}

/** One turn inside the sandbox, on the clock. Whatever comes back out is a sentence the
 *  note on the card can end with. */
function run(script: string, context: vm.Context, src: string): unknown {
  try {
    return vm.runInContext(script, context, { timeout: DRAW_MS, filename: src });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    if (/timed out/i.test(why)) {
      throw new Error(copy.messages.mockup.tooSlow(DRAW_MS / 1000));
    }
    throw new Error(why.replace(/^Error:\s*/, ""));
  }
}

// --- Tailwind ----------------------------------------------------------------

/** `@import "tailwindcss"` resolves to one self-contained file — the theme, the reset and
 *  the utilities. Read once; the compiler is what gets built per mockup. */
let baseCss: { path: string; css: string } | null = null;

function tailwindBase(): { path: string; css: string } {
  if (baseCss) return baseCss;
  const file = findTailwindCss();
  baseCss = { path: file, css: fs.readFileSync(file, "utf8") };
  return baseCss;
}

/** Tailwind's own stylesheet is a file, not code, so it is found rather than imported —
 *  in node_modules beside the built app, or beside where the app was started. Looked for
 *  by walking up, because the bundler rewrites every other way of asking. */
function findTailwindCss(): string {
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
  throw new Error(copy.messages.mockup.noStylesheet);
}

const CLASS_ATTR = /class="([^"]*)"/g;

/** The styling this markup asks for, worked out now rather than when the app was built —
 *  which is what makes every Tailwind class work, including the ones the board's own
 *  screens never use. */
async function tailwindFor(markup: string): Promise<string> {
  const { path: file, css } = tailwindBase();
  const base = path.dirname(file);
  const compiler = await compile('@import "tailwindcss";', {
    base,
    loadStylesheet: async () => ({ path: file, base, content: css }),
  });
  const classes = [...markup.matchAll(CLASS_ATTR)].flatMap((m) => m[1]!.split(/\s+/));
  return compiler.build(classes.filter(Boolean));
}

// --- the document ------------------------------------------------------------

// Nothing loads, nothing runs. The iframe's sandbox already stops the scripts; this stops
// the fonts, images and stylesheets a mockup might reach for, so what the user looks at is
// what the file holds and nothing arrives from anywhere else.
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
