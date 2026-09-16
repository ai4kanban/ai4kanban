// Preview a mockup without the board: `node render-mockup.mjs <entry.tsx> <out.html>`.
//
// Untracked, and written from the recipe in the ui-designer's memory when it goes missing.
// It is the board's own renderer (kanban-ui/lib/mockup.ts) minus the sandbox limits: sucrase
// for the transpile, a `vm` for the run, the folder's own relative imports, and Tailwind
// compiled from the folder's `globals.css`.
//
// It writes HTML and stops. The shot is a second command:
//   <headless-shell> --headless --screenshot=<out.png> --force-device-scale-factor=2 \
//     --window-size=1280,800 file://<out.html>
// A layout that overflows its dialog is only caught in that shot.
//
// Must sit in kanban-ui/ and be run from here — Node resolves its dependencies beside it.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { transform } from "sucrase";
import { compile } from "tailwindcss";

const entry = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3] ?? entry.replace(/\.tsx$/, ".html"));
const folder = path.dirname(entry);

const REQUIRES = /require\(['"]([^'"]+)['"]\)/g;
const EXTS = [".tsx", ".ts", ".jsx", ".js"];

const code = new Map();
const links = new Map();
const sheets = [];
const packages = new Map();

function resolveFile(id, from) {
  const at = path.resolve(path.dirname(from), id);
  const tries = path.extname(at)
    ? [at]
    : [...EXTS.map((e) => at + e), ...EXTS.map((e) => path.join(at, `index${e}`))];
  for (const f of tries) if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  throw new Error(`no such file: ${id} (from ${path.basename(from)})`);
}

async function walk(file) {
  if (code.has(file)) return;
  const js = transform(fs.readFileSync(file, "utf8"), {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "classic",
    filePath: file,
  }).code;
  code.set(file, js);
  const link = new Map();
  links.set(file, link);
  for (const found of js.matchAll(REQUIRES)) {
    const id = found[1];
    if (!id.startsWith(".")) {
      if (!packages.has(id)) packages.set(id, await import(id));
      continue;
    }
    const target = resolveFile(id, file);
    link.set(id, target);
    if (target.endsWith(".css")) {
      if (!sheets.includes(target)) sheets.push(target);
      continue;
    }
    await walk(target);
  }
}

await walk(entry);

const sandbox = { React, console };
const context = vm.createContext(sandbox);
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

function load(file) {
  const done = modules.get(file);
  if (done) return done.exports;
  const mod = { exports: {} };
  modules.set(file, mod);
  const n = order.push(file) - 1;
  vm.runInContext(
    `var __b = __bind(${n});\n(function (module, exports, require) {\n${code.get(file)}\n})(__b.module, __b.exports, __b.require)`,
    context,
    { filename: file },
  );
  return mod.exports;
}

const Component = load(entry).default;
if (typeof Component !== "function") throw new Error("the entry has no default export");
sandbox.__draw = () => renderToStaticMarkup(React.createElement(Component));
const markup = vm.runInContext("__draw()", context);

// Tailwind: the folder's own stylesheets when it has them — that is what carries the app's
// tokens — and plain Tailwind when it has none.
const twFile = path.resolve("node_modules/tailwindcss/index.css");
const tailwind = { path: twFile, base: path.dirname(twFile), content: fs.readFileSync(twFile, "utf8") };
const source = sheets.length
  ? sheets.map((f) => fs.readFileSync(f, "utf8")).join("\n")
  : '@import "tailwindcss";';
const compiler = await compile(source, {
  base: sheets.length ? path.dirname(sheets[0]) : tailwind.base,
  loadStylesheet: async (id, from) => {
    if (id === "tailwindcss" || id.startsWith("tailwindcss/")) return tailwind;
    const at = path.resolve(from, id);
    return { path: at, base: path.dirname(at), content: fs.readFileSync(at, "utf8") };
  },
});
const classes = [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);

fs.writeFileSync(
  out,
  `<!doctype html><html><head><meta charset="utf-8"><style>${compiler.build(classes)}</style></head><body>${markup}</body></html>`,
);
console.log(`${path.relative(folder, entry)} → ${out}`);
process.exit(0);
