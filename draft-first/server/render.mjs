// An `<Asset>` drawn into something the review page can show inline — the same formats an
// AI4Kanban card draws (kanban-ui/lib/mockup.ts), so a draft folder moves onto a card as is.
//
//   .tsx   a React component styled with Tailwind, run once in a bare `vm` and turned into markup
//   .html  a whole page, its local stylesheets inlined
//   .txt   shown as text
//   image  loaded by the page from /files/

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transform } from "sucrase";
import { compile } from "tailwindcss";

const require = createRequire(import.meta.url);
const TAILWIND_CSS = require.resolve("tailwindcss/index.css");

export const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const EXTS = ["tsx", "html", "txt", ...IMAGE_EXTS];
const SRC = new RegExp(`^\\.assets/(?!\\.)([^/\\\\]+)/(?!\\.)([^/\\\\]+)\\.(${EXTS.join("|")})$`, "i");
const CODE_EXTS = [".tsx", ".ts", ".jsx", ".js", ".mjs"];
const REQUIRES = /require\(\s*["']([^"']+)["']\s*\)/g;
const DRAW_MS = 5000;
const MAX_FILES = 60;
const SIZES = { desktop: [1280, 800], mobile: [393, 852] };

const NOTHING = () => {};
const PACKAGES = {
  react: async () => React,
  "react/jsx-runtime": async () => React,
  "next/link": async () => ({
    __esModule: true,
    default: ({ href, children, prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, ...rest }) =>
      React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children),
  }),
  "next/image": async () => ({
    __esModule: true,
    default: ({ src, alt, fill, priority, quality, loader, placeholder, blurDataURL, unoptimized, sizes, ...rest }) =>
      React.createElement("img", { src: typeof src === "string" ? src : (src?.src ?? ""), alt: alt ?? "", ...rest }),
  }),
  "next/navigation": async () => ({
    __esModule: true,
    useRouter: () => ({ push: NOTHING, replace: NOTHING, back: NOTHING, forward: NOTHING, refresh: NOTHING, prefetch: NOTHING }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }),
  "react-icons/fi": () => import("react-icons/fi"),
  "react-icons/fa": () => import("react-icons/fa"),
  "react-icons/si": () => import("react-icons/si"),
  clsx: () => import("clsx"),
  "tailwind-merge": () => import("tailwind-merge"),
  "class-variance-authority": () => import("class-variance-authority"),
};

async function loadPackage(id) {
  const load = PACKAGES[id];
  if (!load) throw new Error(`cannot import "${id}" — a draft may only use React, react-icons/fi, fa or si, next/link, next/image, clsx, tailwind-merge and class-variance-authority`);
  const mod = await load();
  return mod === React ? React : { __esModule: true, ...mod };
}

/** The file an `<Asset src>` names, inside `<draftDir>/.assets/` and nowhere else. */
export function assetFile(draftDir, src) {
  const m = SRC.exec(src);
  if (!m) throw new Error(`"${src}" is not .assets/<folder>/<file> with one of: ${EXTS.map((e) => "." + e).join(" ")}`);
  const file = path.resolve(draftDir, ".assets", m[1], `${m[2]}.${m[3]}`);
  if (!fs.existsSync(file)) throw new Error(`${src} does not exist`);
  return { file, ext: m[3].toLowerCase() };
}

export async function renderAsset(draftDir, { src, label = "", device = "desktop" }) {
  const [width, height] = SIZES[device] ?? SIZES.desktop;
  const base = { src, label, device, width, height };
  try {
    const { file, ext } = assetFile(draftDir, src);
    if (IMAGE_EXTS.includes(ext)) return { ...base, kind: "image", url: `/files/${src}` };
    const text = fs.readFileSync(file, "utf8");
    if (ext === "txt") return { ...base, kind: "text", text };
    const html = ext === "tsx" ? await drawComponent(file) : inlineSheets(text, path.dirname(file));
    return { ...base, kind: "doc", html: shadowDoc(html, height) };
  } catch (e) {
    return { ...base, kind: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

// --- .tsx ---

function resolveFile(id, from, folder) {
  const at = path.resolve(path.dirname(from), id);
  if (at !== folder && !at.startsWith(folder + path.sep)) throw new Error(`"${id}" is outside the draft's folder`);
  const tries = path.extname(at) ? [at] : [...CODE_EXTS.map((e) => at + e), ...CODE_EXTS.map((e) => path.join(at, `index${e}`))];
  for (const f of tries) if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  throw new Error(`no such file: ${id} (from ${path.basename(from)})`);
}

async function drawComponent(entry) {
  const folder = path.dirname(entry);
  const code = new Map();
  const links = new Map();
  const sheets = [];
  const packages = new Map();

  const walk = async (file) => {
    if (code.has(file)) return;
    if (code.size >= MAX_FILES) throw new Error(`more than ${MAX_FILES} files`);
    const js = transform(fs.readFileSync(file, "utf8"), {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      filePath: file,
    }).code;
    code.set(file, js);
    const link = new Map();
    links.set(file, link);
    for (const [, id] of js.matchAll(REQUIRES)) {
      if (!id.startsWith(".")) {
        if (!packages.has(id)) packages.set(id, await loadPackage(id));
        continue;
      }
      const target = resolveFile(id, file, folder);
      link.set(id, target);
      if (target.endsWith(".css")) {
        if (!sheets.some((s) => s.path === target)) sheets.push({ path: target, content: fs.readFileSync(target, "utf8") });
      } else {
        await walk(target);
      }
    }
  };
  await walk(entry);

  const sandbox = { React, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
  const context = vm.createContext(sandbox);
  const deadline = Date.now() + DRAW_MS;
  const run = (script, filename) => {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`took longer than ${DRAW_MS / 1000}s to draw`);
    return vm.runInContext(script, context, { timeout: left, filename });
  };
  const modules = new Map();
  const order = [];
  sandbox.__bind = (n) => {
    const file = order[n];
    const mod = modules.get(file);
    return {
      module: mod,
      exports: mod.exports,
      require: (id) => {
        const target = links.get(file)?.get(id);
        if (target) return target.endsWith(".css") ? {} : load(target);
        if (packages.has(id)) return packages.get(id);
        throw new Error(`cannot import ${id}`);
      },
    };
  };
  const load = (file) => {
    const done = modules.get(file);
    if (done) return done.exports;
    const mod = { exports: {} };
    modules.set(file, mod);
    const n = order.push(file) - 1;
    run(`var __b = __bind(${n});\n(function (module, exports, require) {\n${code.get(file)}\n})(__b.module, __b.exports, __b.require)`, file);
    return mod.exports;
  };

  const Component = load(entry).default;
  if (typeof Component !== "function") throw new Error("the entry has no default export");
  sandbox.__draw = () => renderToStaticMarkup(React.createElement(Component));
  const markup = run("__draw()", entry);
  return `<style>${await tailwindFor(markup, sheets)}</style>${markup}`;
}

async function tailwindFor(markup, sheets) {
  const tailwind = { path: TAILWIND_CSS, base: path.dirname(TAILWIND_CSS), content: fs.readFileSync(TAILWIND_CSS, "utf8") };
  const compiler = await compile(sheets.length ? sheets.map((s) => s.content).join("\n") : '@import "tailwindcss";', {
    base: sheets.length ? path.dirname(sheets[0].path) : tailwind.base,
    loadStylesheet: async (id, from) => {
      if (id === "tailwindcss" || id.startsWith("tailwindcss/")) return tailwind;
      if (!id.startsWith(".")) throw new Error(`cannot import ${id}`);
      const at = path.resolve(from, id);
      return { path: at, base: path.dirname(at), content: fs.readFileSync(at, "utf8") };
    },
  });
  const classes = [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  return compiler.build(classes);
}

// --- .html ---

function inlineSheets(html, folder) {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) return tag;
    const id = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!id || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(id)) return tag;
    const at = path.resolve(folder, id);
    if (!at.startsWith(folder + path.sep) || !fs.existsSync(at)) return tag;
    return `<style>${fs.readFileSync(at, "utf8").replace(/<\/style/gi, "<\\/style")}</style>`;
  });
}

// --- into a shadow root ---

/** A whole document, made to draw inside a shadow root at the device's size: `html`, `:root`
 *  and `body` rules land on the host and a stand-in body, and a screen's height is the device's,
 *  not the browser window's. */
function shadowDoc(html, height) {
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const body = /<body\b([^>]*)>([\s\S]*?)(<\/body>|$)/i.exec(html);
  const attrs = body?.[1] ?? "";
  const inner = (body ? body[2] : html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const cls = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
  const style = /\bstyle\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
  const css = styles
    .join("\n")
    .replace(/(^|[\s,{}>+~(])(html|:root)(?=[\s,{.:#[>+~)])/g, "$1:host")
    .replace(/(^|[\s,{}>+~(])body(?=[\s,{.:#[>+~)])/g, "$1.df-body")
    .replace(/\b100d?vh\b/g, `${height}px`);
  // `@property` does nothing in a shadow root, and Tailwind's shadows and transforms lean on
  // its initial values — so they are set the plain way.
  const initial = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{[^}]*?initial-value:\s*([^;}]+)/g)]
    .map(([, name, value]) => `${name}:${value.trim()}`)
    .join(";");
  const defaults = initial ? `*,::before,::after,::backdrop{${initial}}` : "";
  return `<style>:host{display:block}.df-body{margin:0;min-height:${height}px}${defaults}${css}</style><div class="df-body ${cls}" style="${style}">${inner}</div>`;
}
