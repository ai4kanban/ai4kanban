#!/usr/bin/env node
// Put the board UI's prebuilt server inside the app.
//
// The app ships the very same server `npx ai4kanban-ui` runs — Next's
// `output: "standalone"` bundle from ../kanban-ui. This builds it and copies it
// to desktop/resources/server/, which electron-builder packs into the app as
// an unpacked resource (see electron-builder.yml).
//
//   node scripts/bundle-ui.mjs               # always rebuild
//   node scripts/bundle-ui.mjs --if-missing  # only when there is nothing there
//
// The copy is a build product, not a source file — it is gitignored.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.dirname(here);
const ui = path.join(path.dirname(desktop), "kanban-ui");
const from = path.join(ui, ".next", "standalone");
const to = path.join(desktop, "resources", "server");

const ifMissing = process.argv.includes("--if-missing");
if (ifMissing && fs.existsSync(path.join(to, "server.js"))) {
  console.log("bundle-ui: already there, nothing to do");
  process.exit(0);
}

if (!fs.existsSync(path.join(ui, "package.json"))) {
  console.error(`bundle-ui: no board UI at ${ui}`);
  process.exit(1);
}

console.log("bundle-ui: building the board UI…");
execFileSync("npm", ["run", "build:standalone"], { cwd: ui, stdio: "inherit" });

if (!fs.existsSync(path.join(from, "server.js"))) {
  console.error(`bundle-ui: the build left no server at ${from}`);
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.cpSync(from, to, { recursive: true });
console.log(`bundle-ui: ${path.relative(desktop, to)} ready`);
