#!/usr/bin/env node
// Keep one copy of the board file format.
//
// A card is written by the skill's script and read by the board UI, so the rules
// for reading one have to be the same on both sides — a drift means the script
// writes a card the UI silently misreads. They used to be two hand-kept copies
// of the same code.
//
// `cli/src/lib/` is the source — the board's own rules, in TypeScript, built into
// the one file that ships into the user's repo. The UI takes a copy of the two
// modules it shares rather than the other way round.
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
// The copies are TypeScript, so they carry their own types — a shared module's
// new export reaches the UI with nothing else to write.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = path.join(ROOT, "cli", "src", "lib");
const TO = path.join(ROOT, "kanban-ui", "lib", "format");

// Every module the browser needs a copy of. A module only belongs here once it is
// identical on both sides AND imports nothing but its siblings — anything reaching
// for `paths.ts`, the filesystem or `process` cannot be shared, since the UI serves
// many boards at once and must never exit the process.
//
// Paths are relative to `cli/src/lib/` and land at the same relative path under
// `kanban-ui/lib/format/`, so a module's own imports resolve unchanged.
//
// What each one is here for:
//   cadence, yaml            reading and writing a card — the script writes it, the
//                            server acts on it, and a drift means a misread card.
//   agent/types, providers   what a connector takes and which of its settings the
//                            picked provider needs. The Configuration dialog works
//                            that out while the user is still typing, so it cannot
//                            ask the server.
//   view/types, view/rules   the board as a screen draws it, and the judgments it
//                            makes about a card — is this card refinable, where does
//                            it sort. Both run in the browser.
//   skill/types              whether this project can be driven from a coding agent,
//                            and what one install wrote. The Configuration dialog
//                            draws that answer.
//   cloud/types              which account this MACHINE is signed in to Cloud as (#326).
//                            The Cloud section of the same dialog draws its four states.
//   board/contract           the operations every part of AI4Kanban reads and writes a
//                            board through (#312), the envelope each write carries and the
//                            conflict it can answer with. The server calls them and the
//                            browser names what comes back, so both sides need one copy.
//   machine/types            the languages the app works in (#334) — each one's own name
//                            and its `<html lang>` tag. The switcher draws them and the
//                            layout tags the document with them.
const SHARED = [
  "cadence.ts",
  "yaml.ts",
  "agent/types.ts",
  "agent/providers.ts",
  "machine/types.ts",
  "skill/types.ts",
  "cloud/types.ts",
  "view/types.ts",
  "view/rules.ts",
  "board/contract.ts",
];

const BANNER = (name) =>
  `// Copied from cli/src/lib/${name} by scripts/sync-format.mjs — do not edit here.\n` +
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
  fs.mkdirSync(path.dirname(to), { recursive: true });
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
    `sync-format: ${drifted.join(", ")} differ from cli/src/lib/.\n` +
      "The board format has drifted — the script and the UI would read a card differently.\n" +
      "Run `node scripts/sync-format.mjs` from the repo root.\n",
  );
  process.exit(1);
}

if (check) process.stdout.write("sync-format: in sync\n");
