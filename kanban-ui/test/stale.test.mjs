// A group root goes by the whole group's activity, not root.md's own write time (#1648).
import assert from "node:assert/strict";
import { test } from "node:test";
import { staleDays } from "../lib/stale.ts";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const ago = (days) => new Date(NOW - days * 86_400_000).toISOString();
const sub = (over = {}) => ({ id: 2, title: "", todos: { total: 0, done: 0 }, blocked_by: [], status: "todo", ...over });
const root = (subtasks) => ({ status: "todo", updatedAt: ago(20), isGroup: true, subtasks });

test("a lone card idle over 5 days is stale", () => {
  assert.equal(staleDays({ status: "todo", updatedAt: ago(7.5) }, NOW), 7);
  assert.equal(staleDays({ status: "todo", updatedAt: ago(3) }, NOW), 0);
});

test("a group whose subtask moved lately is not stale", () => {
  assert.equal(staleDays(root([sub({ updatedAt: ago(30) }), sub({ updatedAt: ago(1) })]), NOW), 0);
});

test("a group with a subtask being built is not stale", () => {
  assert.equal(staleDays(root([sub({ status: "implementing", updatedAt: ago(30) })]), NOW), 0);
});

test("a whole group idle counts days from its newest write", () => {
  assert.equal(staleDays(root([sub({ updatedAt: ago(9.2) }), sub({ updatedAt: ago(30) })]), NOW), 9);
});
