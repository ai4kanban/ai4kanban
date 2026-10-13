// A Markdown asset drawn as an article (#1651): its header and MDX lines.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArticle } from "../lib/article.ts";

test("title and dek come off the header, the rest of it is not shown", () => {
  const a = parseArticle('---\ntitle: "A \\"quoted\\" title"\ndek: Short dek # note\ntags: [x]\n---\n\n## Body\n', false);
  assert.equal(a.title, 'A "quoted" title');
  assert.equal(a.dek, "Short dek");
  assert.equal(a.body, "\n## Body\n");
});

test("a file with no header is all body", () => {
  assert.deepEqual(parseArticle("# Hi\n", false), { title: undefined, dek: undefined, body: "# Hi\n" });
});

test("MDX import/export lines are dropped, except inside a fence", () => {
  const a = parseArticle("import X from './x'\n\ntext\n```js\nimport y from 'y'\n```\nexport const z = 1\n", true);
  assert.equal(a.body, "\ntext\n```js\nimport y from 'y'\n```\n");
});
