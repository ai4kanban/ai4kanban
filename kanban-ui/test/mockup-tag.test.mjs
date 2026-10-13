// An `<Asset>` tag's declared versions (#1663).
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockupSources, mockupTags } from "../lib/mockup-tag.ts";

const TAG = `<Asset src=".assets/1/copy.zh.md" label="Copy" variants='{"中文": ".assets/1/copy.zh.md", "English": ".assets/1/copy.en.md"}' />`;

test("variants are read in written order, and every file is read", () => {
  assert.deepEqual(mockupTags(TAG)[0].variants, [
    { label: "中文", src: ".assets/1/copy.zh.md" },
    { label: "English", src: ".assets/1/copy.en.md" },
  ]);
  assert.deepEqual(mockupSources(TAG), [".assets/1/copy.zh.md", ".assets/1/copy.en.md"]);
});

test("variants that do not parse, have one entry, or leave out src are none", () => {
  const tag = (v) => `<Asset src=".assets/1/a.png" label="A" variants='${v}' />`;
  assert.deepEqual(mockupTags(tag("{bad")).at(0).variants, []);
  assert.deepEqual(mockupTags(tag('{"A": ".assets/1/a.png"}')).at(0).variants, []);
  assert.deepEqual(mockupTags(tag('{"B": ".assets/1/b.png", "C": ".assets/1/c.png"}')).at(0).variants, []);
  assert.deepEqual(mockupTags(`<Asset src=".assets/1/a.png" label="A" />`)[0].variants, []);
});
