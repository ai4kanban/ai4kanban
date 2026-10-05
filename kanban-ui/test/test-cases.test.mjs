// The test cases' reader (#1422): listing with and without modules, a case with no `#` title,
// paths that climb out of docs/qa/, missing evidence, and a Setup holding a table and a code block.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { feedbackItem, feedbackRows, hasCases, listCases, readCase, serveCaseFile } from "../lib/test-cases.ts";

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const CASE = `# Reject a card

## Setup

- **Board**: two cards:

  | Card | Title |
  | --- | --- |
  | #2 | Trim |

- **Script**:

  \`\`\`sh
  ## not a section
  akb raw create
  \`\`\`

## Steps

1. Run it.
   It prints.
   [01-run.log](01-run.log)

2. Look.
   ![The page](02-page.png)
   [01-run.log](01-run.log)

3. Gone.
   [03-gone.log](03-gone.log)
   ![Missing](04-gone.png)

## Feedback

Read on a laptop.

- **Clear**: it says so.
- No bold here,
  over two lines.
`;

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-cases-"));
  const qa = path.join(root, "docs", "qa");
  write(path.join(qa, "skill", "reject-a-card", "case.md"), CASE);
  write(path.join(qa, "skill", "reject-a-card", "01-run.log"), "$ akb run\nok\n");
  write(path.join(qa, "skill", "reject-a-card", "02-page.png"), "png");
  write(path.join(qa, "skill", "untitled-case", "case.md"), "## Steps\n\n1. One.\n");
  write(path.join(qa, "local-ui", "open-the-board", "case.md"), "# Open the board\n");
  write(path.join(qa, "zzz-extra", "a-case", "case.md"), "# Extra\n");
  write(path.join(qa, "empty-module", "README.md"), "nothing\n");
  write(path.join(root, "secret.txt"), "secret\n");
  return { root, qa };
}

test("cases grouped by module, in the module map's order", () => {
  const { qa } = project();
  const list = listCases(qa, ["local-ui", "skill"]);
  assert.equal(list.flat, false);
  assert.deepEqual(list.modules.map((m) => m.name), ["local-ui", "skill", "zzz-extra"]);
  assert.equal(list.total, 4);
  const reject = list.modules[1].cases.find((c) => c.slug === "reject-a-card");
  assert.deepEqual(
    { title: reject.title, steps: reject.steps, shots: reject.shots, logs: reject.logs, notes: reject.notes },
    { title: "Reject a card", steps: 3, shots: 2, logs: 2, notes: 2 },
  );
  assert.ok(reject.updated > 0);
});

test("a case with no # title is named by its folder", () => {
  const { qa } = project();
  const skill = listCases(qa).modules.find((m) => m.name === "skill");
  assert.equal(skill.cases.find((c) => c.slug === "untitled-case").title, "untitled-case");
});

test("no module folders: one flat list", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-cases-flat-"));
  write(path.join(root, "one", "case.md"), "# One\n");
  write(path.join(root, "two", "case.md"), "# Two\n");
  const list = listCases(root);
  assert.equal(list.flat, true);
  assert.deepEqual(list.modules[0].cases.map((c) => c.title).sort(), ["One", "Two"]);
  assert.equal(readCase(root, ["one"]).title, "One");
});

test("no cases: nothing to list and no row", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-cases-none-"));
  assert.equal(listCases(path.join(root, "absent")), null);
  write(path.join(root, "skill", "README.md"), "x");
  assert.equal(listCases(root), null);
  assert.equal(hasCases(root), false);
  assert.equal(hasCases(project().qa), true);
});

test("paths that climb out of docs/qa/ are no such thing", async () => {
  const { qa } = project();
  assert.equal(readCase(qa, ["..", ".."]), null);
  assert.equal(readCase(qa, ["skill", "../local-ui/open-the-board"]), null);
  assert.equal(serveCaseFile([qa], ["..", "..", "secret.txt"]).status, 404);
  assert.equal(serveCaseFile([qa], ["skill", "..%2F..%2Fsecret.txt"]).status, 404);
  fs.symlinkSync(path.join(qa, "..", "..", "secret.txt"), path.join(qa, "skill", "reject-a-card", "link.txt"));
  assert.equal(serveCaseFile([qa], ["skill", "reject-a-card", "link.txt"]).status, 404);
  const ok = serveCaseFile([qa], ["skill", "reject-a-card", "01-run.log"]);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "$ akb run\nok\n");
  assert.equal(serveCaseFile([qa], ["skill", "reject-a-card", "case.exe"]).status, 404);
});

test("evidence: text read in, pictures found, missing files said", () => {
  const { qa } = project();
  const file = readCase(qa, ["skill", "reject-a-card"]);
  assert.deepEqual(file.evidence["01-run.log"], { kind: "text", text: "$ akb run\nok", lines: 2 });
  assert.deepEqual(file.evidence["02-page.png"], { kind: "image" });
  assert.deepEqual(file.evidence["03-gone.log"], { kind: "missing" });
  assert.deepEqual(file.evidence["04-gone.png"], { kind: "missing" });
});

test("evidence kept out of git: read and served from .akb/qa/, the case folder still counts", async () => {
  const { root, qa } = project();
  const kept = path.join(root, ".akb", "qa");
  write(path.join(kept, "skill", "reject-a-card", "03-gone.log"), "kept\n");
  write(path.join(kept, "skill", "reject-a-card", "04-gone.png"), "png");
  const file = readCase(qa, ["skill", "reject-a-card"], kept);
  assert.deepEqual(file.evidence["01-run.log"], { kind: "text", text: "$ akb run\nok", lines: 2 });
  assert.deepEqual(file.evidence["03-gone.log"], { kind: "text", text: "kept", lines: 1 });
  assert.deepEqual(file.evidence["04-gone.png"], { kind: "image" });
  assert.equal(await serveCaseFile([kept, qa], ["skill", "reject-a-card", "03-gone.log"]).text(), "kept\n");
  assert.equal(serveCaseFile([kept, qa], ["skill", "reject-a-card", "01-run.log"]).status, 200);
  fs.symlinkSync(path.join(root, "secret.txt"), path.join(kept, "skill", "reject-a-card", "link.txt"));
  assert.equal(serveCaseFile([kept, qa], ["skill", "reject-a-card", "link.txt"]).status, 404);
});

test("Setup with a table and a code block stays one section, as written", () => {
  const { qa } = project();
  const file = readCase(qa, ["skill", "reject-a-card"]);
  assert.deepEqual(file.sections.map((s) => s.kind), ["setup", "steps", "feedback"]);
  const setup = file.sections[0].body;
  assert.match(setup, /\| #2 \| Trim \|/);
  assert.match(setup, /## not a section/);
  assert.equal(file.relPath, "docs/qa/skill/reject-a-card/case.md");
});

test("feedback notes: bold opening as title, other text kept apart", () => {
  const { qa } = project();
  const file = readCase(qa, ["skill", "reject-a-card"]);
  assert.deepEqual(file.feedback, {
    lead: "Read on a laptop.",
    notes: [
      { title: "Clear", body: "it says so.", text: "**Clear**: it says so." },
      { title: null, body: "No bold here,\nover two lines.", text: "No bold here,\nover two lines." },
    ],
  });
  assert.deepEqual(feedbackRows("- **A：** b\n\n  more\n\nAfter."), {
    lead: "After.",
    notes: [{ title: "A：", body: "b\n\nmore", text: "**A：** b\n\nmore" }],
  });
});

test("a feedback note as a triage item: its title, the note as written, and the case it came from", () => {
  const { qa } = project();
  const file = readCase(qa, ["skill", "reject-a-card"]);
  const from = `\n\nFrom test case "Reject a card" — docs/qa/skill/reject-a-card/case.md`;
  assert.deepEqual(feedbackItem(file, 0), { title: "Clear", text: `**Clear**: it says so.${from}` });
  assert.deepEqual(feedbackItem(file, 1), { title: "No bold here,", text: `No bold here,\nover two lines.${from}` });
  assert.equal(feedbackItem(file, 2), null);
  const long = { ...file, feedback: { lead: "", notes: [{ title: null, body: "x".repeat(150), text: "x".repeat(150) }] } };
  assert.equal(feedbackItem(long, 0).title, `${"x".repeat(99)}…`);
});
