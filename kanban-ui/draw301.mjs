import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { transform } from "sucrase";
import { compile } from "tailwindcss";

const dir = "/Users/wutao/git/ai4kanban/docs/kanban/.mockups/301";
const tw = fs.readFileSync("/Users/wutao/git/ai4kanban/kanban-ui/node_modules/tailwindcss/index.css", "utf8");

for (const name of ["a", "b", "c"]) {
  const src = path.join(dir, `${name}.tsx`);
  const code = fs.readFileSync(src, "utf8");
  const js = transform(code, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "classic", filePath: src }).code;
  const mod = { exports: {} };
  const sandbox = { React, module: mod, exports: mod.exports, require: () => React, console };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(js, ctx, { timeout: 3000, filename: src });
  const C = mod.exports.default;
  if (typeof C !== "function") throw new Error(name + ": no default component");
  sandbox.__draw = () => renderToStaticMarkup(React.createElement(C));
  const markup = vm.runInContext("__draw()", ctx, { timeout: 3000 });
  const classes = new Set();
  for (const m of markup.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  const compiler = await compile(`@import "tailwindcss";`, {
    base: "/Users/wutao/git/ai4kanban/kanban-ui",
    loadStylesheet: async () => ({ base: "/Users/wutao/git/ai4kanban/kanban-ui", content: tw }),
  });
  const css = compiler.build([...classes]);
  fs.writeFileSync(`/tmp/301-${name}.html`, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0">${markup}</body></html>`);
  console.log(name, "ok", markup.length, "chars,", classes.size, "classes");
}
