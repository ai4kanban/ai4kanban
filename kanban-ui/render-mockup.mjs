// Preview a mockup without the board: transpile the entry and every relative import it pulls
// in, render with react-dom/server, and compile the CSS from the mockup folder's own
// globals.css over the classes the markup actually uses.
//
//   node render-mockup.mjs <entry.tsx> <out.html>
//
// Must SIT in kanban-ui/ and be RUN from there — Node resolves sucrase, tailwindcss and
// react-dom/server beside the script.

import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { transform } from "sucrase";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";

const nodeRequire = createRequire(import.meta.url);
const src = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const dir = path.dirname(src);

// Everything the sandbox is allowed to reach. A mockup that needs anything else has to carry
// it as a file in its own folder.
const PACKAGES = {
  react: React,
  "react-icons/fi": nodeRequire("react-icons/fi"),
  "react-icons/fa": nodeRequire("react-icons/fa"),
  "react-icons/si": nodeRequire("react-icons/si"),
  clsx: nodeRequire("clsx"),
  "tailwind-merge": nodeRequire("tailwind-merge"),
  "class-variance-authority": nodeRequire("class-variance-authority"),
};

const loaded = new Map();
let stylesheet = "";

function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const code = fs.readFileSync(file, "utf8");
  const js = transform(code, { transforms: ["typescript", "jsx", "imports"] }).code;
  // One object for `module.exports` and `exports`, or the default export comes back undefined.
  const exports = {};
  const module = { exports };
  loaded.set(file, exports);
  const sandbox = { React, module, exports, console, require: (id) => resolve(id, file) };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox, { filename: file });
  // A module that reassigned module.exports rather than writing onto it.
  if (module.exports !== exports) loaded.set(file, module.exports);
  return loaded.get(file);
}

function resolve(id, from) {
  if (id in PACKAGES) return PACKAGES[id];
  if (!id.startsWith(".")) throw new Error(`${path.basename(from)} imports ${id}, which the sandbox has not got`);
  const target = path.resolve(path.dirname(from), id);
  if (target.endsWith(".css")) {
    stylesheet = target;
    return {};
  }
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) return load(target + ext);
  }
  throw new Error(`${path.basename(from)} imports ${id}, which is not in the folder`);
}

const Comp = load(src).default;
if (!Comp) throw new Error("no default export");
const markup = renderToStaticMarkup(React.createElement(Comp));

// The folder's own stylesheet carries the theme. Without it the copy loses the product's
// colours, fonts and spacing.
const entry = stylesheet ? fs.readFileSync(stylesheet, "utf8") : '@import "tailwindcss";';
const compiler = await compile(entry, {
  base: stylesheet ? path.dirname(stylesheet) : dir,
  loadStylesheet: async (id, base) => {
    if (id === "tailwindcss") {
      const p = path.join(process.cwd(), "node_modules", "tailwindcss", "index.css");
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, "utf8") };
    }
    const p = path.resolve(base, id);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, "utf8") };
  },
});
const classes = [
  ...new Set(markup.match(/class="([^"]*)"/g)?.flatMap((m) => m.slice(7, -1).split(/\s+/)) ?? []),
];
const css = compiler.build(classes);
fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`);
console.log("ok", out, markup.length);
