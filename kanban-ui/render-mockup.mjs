import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { transform } from "sucrase";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";

const src = process.argv[2];
const out = process.argv[3];
const code = fs.readFileSync(src, "utf8");
const js = transform(code, { transforms: ["typescript", "jsx", "imports"] }).code;
const exportsObj = {};
const sandbox = { React, module: { exports: exportsObj }, exports: exportsObj, console };
sandbox.module.exports = exportsObj;
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const Comp = exportsObj.default;
if (!Comp) throw new Error("no default export");
const markup = renderToStaticMarkup(React.createElement(Comp));

const compiler = await compile('@import "tailwindcss";', {
  base: process.cwd(),
  loadStylesheet: async () => {
    const p = path.join(process.cwd(), "node_modules", "tailwindcss", "index.css");
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, "utf8") };
  },
});
const classes = [...new Set(markup.match(/class="([^"]*)"/g)?.flatMap((m) => m.slice(7, -1).split(/\s+/)) ?? [])];
const css = compiler.build(classes);
fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`);
console.log("ok", out, markup.length);
