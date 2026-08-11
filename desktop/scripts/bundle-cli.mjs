#!/usr/bin/env node
// Put the board installer inside the app.
//
// The app has to be able to make a board in a folder that has none (#178), and
// there is no terminal in a window and no Node on the machine to run `npx
// ai4kanban install` with. So the app carries that same package — ../cli, plus
// the repo's skill/ as the `skill/` folder it installs from — and runs it under
// Electron's own Node (see lib/board-init.js).
//
//   node scripts/bundle-cli.mjs
//
// The copy is a build product, not a source file — it is gitignored.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.dirname(here);
const repo = path.dirname(desktop);
const cli = path.join(repo, "cli");
const skill = path.join(repo, "skill");
const to = path.join(desktop, "resources", "cli");

for (const [what, at] of [
  ["the CLI", path.join(cli, "bin", "ai4kanban.mjs")],
  ["the skill", path.join(skill, "SKILL.md")],
]) {
  if (!fs.existsSync(at)) {
    console.error(`bundle-cli: ${what} is missing at ${at}`);
    process.exit(1);
  }
}

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });
// Exactly what the published tarball carries: bin/, skill/, and the
// package.json the CLI reads its own version out of.
fs.cpSync(path.join(cli, "bin"), path.join(to, "bin"), { recursive: true });
fs.cpSync(skill, path.join(to, "skill"), { recursive: true });
fs.copyFileSync(path.join(cli, "package.json"), path.join(to, "package.json"));
console.log(`bundle-cli: ${path.relative(desktop, to)} ready`);
