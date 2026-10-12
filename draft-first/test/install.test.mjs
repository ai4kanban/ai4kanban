import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const BIN = new URL("../bin/draft-first.mjs", import.meta.url).pathname;

test("install writes both skill folders, and a project helper overrides or adds", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "df-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync(process.execPath, [BIN, "install"], { cwd: dir });
  execFileSync(process.execPath, [BIN, "install"], { cwd: dir });
  for (const rel of [".claude/skills/draft-first", ".agents/skills/draft-first"]) {
    assert.ok(fs.existsSync(path.join(dir, rel, "SKILL.md")));
    assert.equal(fs.readdirSync(path.join(dir, rel, "helpers")).length, 6);
    assert.match(fs.readFileSync(path.join(dir, rel, "scripts/review.mjs"), "utf8"), /^const VERSION = "\d+\.\d+\.\d+";$/m);
  }
  fs.mkdirSync(path.join(dir, ".draft-first/helpers"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".draft-first/helpers/copywriting.md"), "---\ndescription: Our own copy rules.\n---\n");
  fs.writeFileSync(path.join(dir, ".draft-first/helpers/data-model.md"), "---\ndescription: A new table or column.\n---\n");
  fs.mkdirSync(path.join(dir, "sub"));
  const out = execFileSync(process.execPath, [path.join(dir, ".claude/skills/draft-first/scripts/helpers.mjs")], {
    cwd: path.join(dir, "sub"),
    encoding: "utf8",
  });
  assert.match(out, /^copywriting {2}\.\.\/\.draft-first\/helpers\/copywriting\.md\n {2}Our own copy rules\.$/m);
  assert.match(out, /^data-model {2}\.\.\/\.draft-first\/helpers\/data-model\.md$/m);
  assert.match(out, /^ui-designer {2}\.\.\/\.claude\/skills\/draft-first\/helpers\/ui-designer\.md$/m);
  assert.equal(out.match(/^\S/gm).length, 7);
});
