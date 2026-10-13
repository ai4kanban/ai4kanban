import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { confirmContract, parseContract } from "../server/contract.mjs";
import { contractModel } from "../server/model.mjs";

const DIR = new URL("./fixture/.draft-first/", import.meta.url).pathname;
const TEXT = fs.readFileSync(`${DIR}ai-commit-message.md`, "utf8");

test("cuts a contract into sections, drafts and agent lines", () => {
  const c = parseContract(TEXT);
  assert.equal(c.status, "draft");
  assert.equal(c.title, "AI 生成 commit message");
  assert.deepEqual(
    c.sections.map((s) => [s.title, s.drafts.map((d) => d.heading)]),
    [
      ["设置页长什么样", ["A：单页表单", "B：分步向导"]],
      ["生成 commit message 的 Prompt", [null]],
      ["选哪个模型 SDK", [null]],
    ],
  );
  assert.equal(c.agent.items.length, 3);
});

test("a confirm drops deleted drafts, writes notes and the status", () => {
  const out = confirmContract(TEXT, { deleted: ["s0d1"], notes: { s0d0: "跟随系统", a1: "要提示" } });
  assert.match(out, /^---\nstatus: confirmed\n---/);
  assert.doesNotMatch(out, /分步向导/);
  assert.match(out, /settings-form\.tsx.*\n\n> Note: 跟随系统\n/);
  assert.match(out, /改动统计。\n  > Note: 要提示\n/);
  assert.equal(parseContract(out).status, "confirmed");
});

test("deleting every draft of a section drops the section", () => {
  const out = confirmContract(TEXT, { deleted: ["s2d0"] });
  assert.doesNotMatch(out, /选哪个模型 SDK/);
  assert.match(out, /<!-- agent -->/);
});

test("headings inside code blocks are not sections", () => {
  const c = parseContract("# T\n\n## A\n\nline\n\n```md\n## not a section\n<!-- agent -->\n```\n");
  assert.equal(c.sections.length, 1);
  assert.equal(c.agent, null);
});

test("the model draws every asset and reports none broken", async () => {
  const m = await contractModel(DIR, "ai-commit-message", TEXT);
  assert.deepEqual(m.problems, []);
  assert.deepEqual(m.assets.map((a) => a.kind), ["doc", "doc"]);
  assert.match(m.introHtml, /<svg/);
});

test("a broken asset is a problem the agent is told about", async () => {
  const m = await contractModel(DIR, "x", "# X\n\n## A\n\nline\n\n<Asset src=\".assets/x/nope.tsx\" />\n\n<!-- agent -->\n");
  assert.equal(m.problems.length, 1);
  assert.match(m.problems[0], /nope\.tsx/);
});

test("a long draft in a .md asset is one draft, its headings drawn, not alternatives", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "df-"));
  fs.mkdirSync(path.join(dir, ".assets/p"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".assets/p/prompt.md"), "### Sample A\n\nfirst\n\n### Sample B\n\nsecond\n");
  const text = '# P\n\n## The prompt\n\n<Asset src=".assets/p/prompt.md" />\n\n<!-- agent -->\n';
  assert.deepEqual(parseContract(text).sections[0].drafts.map((d) => d.heading), [null]);
  const m = await contractModel(dir, "p", text);
  assert.deepEqual(m.problems, []);
  assert.equal(m.assets[0].kind, "markdown");
  assert.match(m.assets[0].html, /<h3>Sample A<\/h3>[\s\S]*<h3>Sample B<\/h3>/);
  assert.match(confirmContract(text), /^---\nstatus: confirmed\n---[\s\S]*prompt\.md/);
});
