// A Markdown asset drawn as an article (#1651): its header, MDX lines and language suffix.
import assert from "node:assert/strict";
import { test } from "node:test";
import { articleName, languageName, parseArticle } from "../lib/article.ts";

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

test("a language suffix is read only when it names a language", () => {
  assert.deepEqual(articleName("copy.en.md"), { base: "copy", lang: "en", ext: "md" });
  assert.deepEqual(articleName("draft.zh.mdx"), { base: "draft", lang: "zh", ext: "mdx" });
  assert.deepEqual(articleName("copy.md"), { base: "copy", lang: null, ext: "md" });
  assert.equal(articleName("notes.qq9.md")?.lang, null);
  assert.equal(languageName("zh"), "中文");
  assert.equal(languageName("en"), "English");
});
