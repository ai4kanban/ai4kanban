#!/usr/bin/env node
// Lists every helper — the ones shipped beside this script, then the project's own in
// `.draft-first/helpers/`, which override a shipped one of the same name.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHIPPED = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "helpers");

/** The project's helper folder: from the working directory up to the git root. */
function projectHelpers(start) {
  let dir = path.resolve(start);
  for (;;) {
    const at = path.join(dir, ".draft-first", "helpers");
    if (fs.existsSync(at)) return at;
    if (fs.existsSync(path.join(dir, ".git"))) return null;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function description(file) {
  const text = fs.readFileSync(file, "utf8");
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const line = /^description:\s*(.*)$/m.exec(front)?.[1]?.trim() ?? "";
  return line.replace(/^(["'])(.*)\1$/, "$2");
}

export function listHelpers(cwd = process.cwd()) {
  const found = new Map();
  for (const dir of [SHIPPED, projectHelpers(cwd)]) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".md")) continue;
      const file = path.join(dir, name);
      found.set(name.slice(0, -3), { file, description: description(file) });
    }
  }
  return [...found].map(([name, h]) => ({ name, ...h }));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const h of listHelpers()) {
    console.log(`${h.name}  ${path.relative(process.cwd(), h.file) || h.file}`);
    console.log(`  ${h.description || "(no description)"}`);
  }
}
