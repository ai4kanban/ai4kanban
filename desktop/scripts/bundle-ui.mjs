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

// The tree has to be symlink-free, so the board UI must be installed with npm —
// `kanban-ui/package-lock.json` is its lockfile. A pnpm install there leaves
// Next's standalone output full of links into `node_modules/.pnpm`, and every
// copy after this one rewrites them to absolute paths pointing back at this
// checkout: `cpSync` does it even with `dereference`, and so does
// electron-builder. The app that comes out has a server that only runs on the
// build machine, and codesign refuses to seal it — "invalid destination for
// symbolic link in bundle". Stop at the copy instead, where the fix is one line
// to run.
const link = findSymlink(from);
if (link) {
  console.error(`bundle-ui: the build left a symlink at ${path.relative(from, link)}`);
  console.error(`bundle-ui: install the board UI with npm — \`cd ${path.relative(desktop, ui)} && npm ci\``);
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.cpSync(from, to, { recursive: true });
console.log(`bundle-ui: ${path.relative(desktop, to)} ready`);

function findSymlink(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return full;
    if (entry.isDirectory()) {
      const hit = findSymlink(full);
      if (hit) return hit;
    }
  }
  return null;
}
