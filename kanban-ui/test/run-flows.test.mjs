// A sub-run joins its parent's job without ever standing for it (#1421).
import assert from "node:assert/strict";
import { test } from "node:test";
import { runFlows } from "../lib/run-flows.ts";

const run = (sessionId, startedAt, more = {}) => ({
  sessionId,
  startedAt,
  cardId: null,
  action: "scheduled",
  status: "running",
  flow: { id: "f", round: 1 },
  ...more,
});

test("a sub-run is in its parent's job, and the job is still read off the parent", () => {
  const [flow, ...rest] = runFlows([
    run("parent", 1),
    run("sub-1", 2, { action: "sub", parentId: "parent", status: "done" }),
    run("sub-2", 3, { action: "sub", parentId: "parent", status: "error" }),
  ]);
  assert.equal(rest.length, 0);
  assert.deepEqual(flow.sessions.map((s) => s.sessionId), ["parent", "sub-1", "sub-2"]);
  assert.equal(flow.latest.sessionId, "parent");
  assert.equal(flow.latest.status, "running");
});
