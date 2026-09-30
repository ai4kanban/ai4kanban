// How a run ended, in the interface language (#1241); a note with no kinds as written.
import assert from "node:assert/strict";
import { test } from "node:test";
import { failureReason, noteParts } from "../lib/start-failure.ts";
import en from "../i18n/runs/en.ts";
import zh from "../i18n/runs/zh.ts";

const copy = (runs, plan) => ({ runs, configuration: { workflows: { stages: { plan } } } });
const ZH = copy(zh, "规划");
const EN = copy(en, "planning");

test("a silent run, in either language", () => {
  const why = [{ kind: "silent", args: { n: "30" } }];
  assert.equal(failureReason(why, ZH), "Agent 连续 30 分钟没有输出，运行已结束。");
  assert.equal(failureReason(why, EN), "The agent said nothing for 30 minutes, so the run was ended.");
});

test("nothing for an error the board did not word", () => {
  assert.equal(failureReason(undefined, ZH), undefined);
  assert.equal(failureReason([{ text: "agent said so" }], ZH), undefined);
});

test("a note by kind, its quoted lines as written", () => {
  const why = [{ kind: "broken", args: { n: "3", more: "1" }, lines: ["x", "y"] }];
  assert.deepEqual(noteParts("the work is done…", why, ZH), [
    { line: "工作已完成，但这次运行让看板出现了 3 处不一致，需要修正：", lines: ["x", "y", "…还有 1 处"] },
  ]);
});

test("an old note, or one with a kind this screen does not know, as written", () => {
  assert.deepEqual(noteParts("an old note", undefined, ZH), [{ line: "an old note" }]);
  assert.deepEqual(noteParts("an old note", [{ kind: "fromTheFuture" }], ZH), [{ line: "an old note" }]);
});

test("the stage named in the interface language", () => {
  const why = [{ kind: "stageShort", args: { stage: "plan", card: "7", agents: "ui-designer" } }];
  assert.match(noteParts("", why, ZH)[0].line, /^#7 的规划阶段未完成：ui-designer/);
});
