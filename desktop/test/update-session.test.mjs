// The states the chip draws, the retries behind `downloading`, and the guards on
// the way between them.

import assert from "node:assert/strict";
import test from "node:test";
import { UpdateFailed } from "../out/lib/update/failure.js";
import { RETRY_WAITS, UpdateSession, verdictOn } from "../out/lib/update/session.js";

const FOUND = {
  version: "0.9.0",
  file: { url: "AI4Kanban-0.9.0-arm64-mac.zip", sha512: "SHA==", size: 400 },
  assetUrl: "https://example.invalid/AI4Kanban-0.9.0-arm64-mac.zip",
};

/** A session whose every step is recorded. `fail` is thrown by each download
 *  attempt until it runs out of entries — one per attempt, so a retry ladder can
 *  be walked without any of it being real. */
function session({ fail = [], blocked = null, apply = null, stage = null } = {}) {
  const log = [];
  const waits = [];
  const s = new UpdateSession(FOUND, blocked, {
    stage(name) {
      if (stage) throw stage;
      return `/tmp/${name}`;
    },
    async download(url, into, expected, onProgress) {
      log.push(["download", url, into, expected]);
      onProgress(200, 400);
      const e = fail.shift();
      if (e) throw e;
      onProgress(400, 400);
    },
    async prepare(file) {
      log.push(["prepare", file]);
    },
    apply(file) {
      if (apply) throw apply;
      log.push(["apply", file]);
    },
    discard: () => log.push(["discard"]),
    wait: async (ms) => waits.push(ms),
    changed: () => log.push(["changed", s.stage, s.received]),
  });
  return { s, log, waits };
}

const downloads = (log) => log.filter((e) => e[0] === "download").length;

test("the app downloads it itself, shows progress, and ends ready", async () => {
  const { s, log } = session();
  assert.equal(s.stage, "idle");
  await s.start();
  assert.equal(s.stage, "ready");
  assert.deepEqual(log[0], ["changed", "downloading", 0]);
  assert.deepEqual(
    log.filter((e) => e[0] === "download")[0],
    ["download", FOUND.assetUrl, "/tmp/AI4Kanban-0.9.0-arm64-mac.zip", "SHA=="],
  );
  assert.ok(log.some((e) => e[0] === "changed" && e[1] === "downloading" && e[2] === 200));
  assert.deepEqual(log.at(-1), ["changed", "ready", 400]);
  assert.equal(s.status().failure, null);
});

test("a second start while one is going starts nothing", async () => {
  const { s, log } = session();
  const first = s.start();
  await s.start();
  await first;
  assert.equal(downloads(log), 1);
});

test("a retriable failure is waited out and tried again, and nobody is told", async () => {
  const { s, log, waits } = session({
    fail: [new UpdateFailed("network"), new UpdateFailed("server")],
  });
  await s.start();
  assert.equal(s.stage, "ready");
  assert.equal(downloads(log), 3);
  assert.deepEqual(waits, RETRY_WAITS.slice(0, 2));
  // Nothing outside ever saw anything but `downloading` on the way.
  const stages = log.filter((e) => e[0] === "changed").map((e) => e[1]);
  assert.deepEqual([...new Set(stages)], ["downloading", "ready"]);
  assert.equal(s.status().failure, null);
});

test("three retries and no more, and then the category is shown", async () => {
  const { s, log, waits } = session({
    fail: Array.from({ length: 9 }, () => new UpdateFailed("server")),
  });
  await s.start();
  assert.equal(downloads(log), RETRY_WAITS.length + 1);
  assert.deepEqual(waits, RETRY_WAITS);
  assert.equal(s.stage, "idle");
  assert.equal(s.status().failure, "server");
  assert.equal(s.install(FOUND.version), false);
});

test("a failure waiting will not fix gives up at once", async () => {
  const { s, log, waits } = session({ fail: [new UpdateFailed("disk")] });
  await s.start();
  assert.equal(downloads(log), 1);
  assert.deepEqual(waits, []);
  assert.equal(s.stage, "idle");
  assert.equal(s.status().failure, "disk");
});

test("nowhere to download to is the same failure, with its own category", async () => {
  const { s, log } = session({ stage: Object.assign(new Error("no room"), { code: "ENOSPC" }) });
  await s.start();
  assert.equal(downloads(log), 0);
  assert.equal(s.stage, "idle");
  assert.equal(s.status().failure, "disk");
});

test("an unrecognised failure is `unknown`, and is not retried", async () => {
  const { s, log, waits } = session({ fail: [new Error("something nobody named")] });
  await s.start();
  assert.equal(downloads(log), 1);
  assert.deepEqual(waits, []);
  assert.equal(s.status().failure, "unknown");
});

test("a version given up for a higher one never becomes ready", async () => {
  const { s, log } = session();
  const going = s.start();
  s.abandon();
  await going;
  // The download ran to its end — there is no way to stop one — and then went
  // in the bin. Nothing that listens heard about it.
  assert.notEqual(s.stage, "ready");
  assert.equal(s.install(FOUND.version), false);
  assert.ok(log.some((e) => e[0] === "discard"));
  const after = log.slice(log.findIndex((e) => e[0] === "prepare"));
  assert.equal(after.filter((e) => e[0] === "changed").length, 0);
});

test("a version given up before it started downloads nothing", async () => {
  const { s, log } = session();
  s.abandon();
  await s.start();
  assert.equal(downloads(log), 0);
});

test("the restart is what installs, and only the version that was shown", async () => {
  const { s, log } = session();
  assert.equal(s.install(FOUND.version), false);
  await s.start();
  // A press that lands after a higher release superseded what it showed.
  assert.equal(s.install("0.8.0"), false);
  assert.equal(s.install(FOUND.version), true);
  assert.deepEqual(log.at(-1), ["apply", "/tmp/AI4Kanban-0.9.0-arm64-mac.zip"]);
});

test("a swap that will not start leaves the app up and says why", async () => {
  const { s } = session({ apply: Object.assign(new Error("nope"), { code: "EACCES" }) });
  await s.start();
  assert.equal(s.install(FOUND.version), false);
  assert.equal(s.stage, "idle");
  assert.equal(s.status().failure, "permission");
});

test("a copy that cannot replace itself downloads nothing and says so", async () => {
  const { s, log } = session({ blocked: "readOnly" });
  assert.equal(s.status().failure, "readOnly");
  await s.start();
  assert.deepEqual(log, []);
});

// --- what a fresh check means for the download in hand -----------------------

const held = (version, stage, failure = null) => ({ version, stage, failure });

test("a check that finds nothing leaves a download going alone", () => {
  assert.equal(verdictOn(held("0.9.1", "downloading"), null), "keep");
  assert.equal(verdictOn(held("0.9.1", "ready"), null), "keep");
  // Including one that gave up: its reason is still what the chip is showing.
  assert.equal(verdictOn(held("0.9.1", "idle", "network"), null), "keep");
});

test("a check that finds nothing on a copy with nothing clears the chip", () => {
  assert.equal(verdictOn(null, null), "clear");
  assert.equal(verdictOn(held("0.9.1", "idle"), null), "clear");
});

test("a higher release takes over from whatever is in hand", () => {
  assert.equal(verdictOn(null, { version: "0.9.1" }), "supersede");
  assert.equal(verdictOn(held("0.9.1", "downloading"), { version: "0.9.2" }), "supersede");
  assert.equal(verdictOn(held("0.9.1", "ready"), { version: "0.9.2" }), "supersede");
});

test("the same version is kept while it is going, and retried once it gave up", () => {
  assert.equal(verdictOn(held("0.9.1", "downloading"), { version: "0.9.1" }), "keep");
  assert.equal(verdictOn(held("0.9.1", "ready"), { version: "0.9.1" }), "keep");
  // The menu after a failure: this is what gets the update without a restart.
  assert.equal(verdictOn(held("0.9.1", "idle", "network"), { version: "0.9.1" }), "retry");
});

test("a feed that goes backwards does not undo a version already in hand", () => {
  assert.equal(verdictOn(held("0.9.2", "ready"), { version: "0.9.1" }), "keep");
  assert.equal(verdictOn(held("0.9.2", "idle", "network"), { version: "0.9.1" }), "keep");
});
