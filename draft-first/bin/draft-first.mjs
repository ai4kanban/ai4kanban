#!/usr/bin/env node
// `draft-first install` — puts the skill into this project for every agent that reads
// `.claude/skills/` or `.agents/skills/`. Running it again updates it.
// `draft-first serve <project>` — the review service `scripts/review.mjs` starts.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));
const TARGETS = [
  { rel: path.join(".claude", "skills", "draft-first"), agent: "Claude Code" },
  { rel: path.join(".agents", "skills", "draft-first"), agent: "Codex, Cursor, OpenCode and others" },
];

function projectRoot() {
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

function install() {
  const root = projectRoot();
  for (const { rel, agent } of TARGETS) {
    const to = path.join(root, rel);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.join(to, "scripts"), { recursive: true });
    fs.copyFileSync(path.join(PKG, "SKILL.md"), path.join(to, "SKILL.md"));
    fs.cpSync(path.join(PKG, "helpers"), path.join(to, "helpers"), { recursive: true });
    fs.copyFileSync(path.join(PKG, "scripts", "helpers.mjs"), path.join(to, "scripts", "helpers.mjs"));
    const review = fs.readFileSync(path.join(PKG, "scripts", "review.mjs"), "utf8");
    fs.writeFileSync(path.join(to, "scripts", "review.mjs"), review.replace(/^const VERSION = ".*";$/m, `const VERSION = "${version}";`));
    console.log(`✓ ${rel} (${agent})`);
  }
  console.log(`\ndraft-first ${version} is installed. Ask your agent for a change; it drafts the key parts for you to review first.`);
  console.log("Add your own helpers in .draft-first/helpers/ — https://ai4kanban.dev/draft-first");
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "install") install();
else if (cmd === "serve") {
  process.argv[2] = arg ?? process.cwd();
  await import("../server/serve.mjs");
} else {
  console.log(`draft-first ${version}\n\n  npx draft-first install    add the skill to this project, or update it`);
  process.exit(cmd ? 1 : 0);
}
