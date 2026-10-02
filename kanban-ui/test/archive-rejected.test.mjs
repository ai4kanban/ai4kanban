// A rejected card's label (#1229) and its reason's label (#1379) in the archive, in both languages.
import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/rail/en.ts";
import zh from "../i18n/rail/zh.ts";

test("the archive names a rejected card, and says it never shipped", () => {
  assert.deepEqual([zh.archive.card.rejected, zh.archive.card.rejectedTip], ["已否决", "已否决，未交付"]);
  assert.deepEqual([en.archive.card.rejected, en.archive.card.rejectedTip], ["Rejected", "Rejected, not shipped"]);
});

test("a rejected card's reason is labelled", () => {
  assert.deepEqual([zh.archive.card.reason, en.archive.card.reason], ["否决原因", "Reason"]);
});
