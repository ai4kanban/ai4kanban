#!/usr/bin/env node
// Keep one copy of the board file format.
//
// A card is written by the skill's script and read by the board UI, so the rules
// for reading one have to be the same on both sides — a drift means the script
// writes a card the UI silently misreads. They used to be two hand-kept copies
// of the same code.
//
// `skill/lib/` is the source. It is plain, dependency-free ESM because it ships
// into the user's repo and runs under bare `node` with nothing installed — so
// the UI takes a copy of it rather than the other way round.
//
//   node scripts/sync-format.mjs           # refresh the copies
//   node scripts/sync-format.mjs --check   # fail when they have drifted
//
// The copies ARE committed, unlike the bundle-* build products: `next build`,
// `tsc` and the desktop bundle all have to work on a fresh checkout with no
// build step run first. `--check` in kanban-ui's lint is what keeps them honest.
//
// Copying rather than importing across the tree is deliberate: an import out of
// kanban-ui/ would drag Next's `outputFileTracingRoot` into it, and that output
// is what desktop/scripts/bundle-ui.mjs packs into the shipped app.
//
// Types live beside each copy in a hand-written `.d.mts`, which this never
// touches. Add a function to a shared module and the `.d.mts` needs the same
// line, or the UI won't see it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = path.join(ROOT, "skill", "lib");
const TO = path.join(ROOT, "kanban-ui", "lib", "format");

// Every module that both sides read a card with. A module only belongs here once
// it is identical on both sides AND imports nothing but its siblings — anything
// reaching for `paths.mjs`, the filesystem or `process` cannot be shared, since
// the UI serves many boards at once and must never exit the process.
const SHARED = ["cadence.mjs", "yaml.mjs"];

const BANNER = (name) =>
  `// Copied from skill/lib/${name} by scripts/sync-format.mjs — do not edit here.\n` +
  `// Edit the original and re-run \`node scripts/sync-format.mjs\`.\n\n`;

const check = process.argv.includes("--check");
const drifted = [];

fs.mkdirSync(TO, { recursive: true });

for (const name of SHARED) {
  const from = path.join(FROM, name);
  if (!fs.existsSync(from)) {
    process.stderr.write(`sync-format: no ${name} at ${from}\n`);
    process.exit(1);
  }
  const want = BANNER(name) + fs.readFileSync(from, "utf8");
  const to = path.join(TO, name);
  const have = fs.existsSync(to) ? fs.readFileSync(to, "utf8") : null;
  if (have === want) continue;
  if (check) {
    drifted.push(name);
    continue;
  }
  fs.writeFileSync(to, want);
  process.stdout.write(`sync-format: wrote ${path.relative(ROOT, to)}\n`);
}

if (drifted.length > 0) {
  process.stderr.write(
    `sync-format: ${drifted.join(", ")} differ from skill/lib/.\n` +
      "The board format has drifted — the script and the UI would read a card differently.\n" +
      "Run `node scripts/sync-format.mjs` from the repo root.\n",
  );
  process.exit(1);
}

if (check) process.stdout.write("sync-format: in sync\n");
