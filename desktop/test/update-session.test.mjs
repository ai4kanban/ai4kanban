// The three states the notice draws, and the guards on the way between them.

import assert from "node:assert/strict";
import test from "node:test";
import { UpdateSession } from "../out/lib/update/session.js";

const FOUND = {
  version: "0.9.0",
  url: "https://example.invalid/releases/latest",
  file: { url: "AI4Kanban-0.9.0-arm64-mac.zip", sha512: "SHA==", size: 400 },
  assetUrl: "https://example.invalid/AI4Kanban-0.9.0-arm64-mac.zip",
};

function session({ fail = null, blocked = null } = {}) {
  const log = [];
  const s = new UpdateSession(FOUND, blocked, {
    stage: (name) => `/tmp/${name}`,
    async download(url, into, expected, onProgress) {
      log.push(["download", url, into, expected]);
      onProgress(200, 400);
      if (fail) throw new Error(fail);
      onProgress(400, 400);
    },
    async prepare(file) {
      log.push(["prepare", file]);
    },
    apply(file) {
      log.push(["apply", file]);
    },
    changed: () => log.push(["changed", s.stage, s.received]),
  });
  return { s, log };
}

test("nothing downloads before the click", () => {
  const { s, log } = session();
  assert.equal(s.stage, "idle");
  assert.equal(s.status().received, 0);
  assert.deepEqual(log, []);
});

test("a click downloads, shows progress, and ends ready", async () => {
  const { s, log } = session();
  await s.start();
  assert.equal(s.stage, "ready");
  assert.deepEqual(log[0], ["changed", "downloading", 0]);
  assert.deepEqual(
    log.filter((e) => e[0] === "download")[0],
    ["download", FOUND.assetUrl, "/tmp/AI4Kanban-0.9.0-arm64-mac.zip", "SHA=="],
  );
  assert.ok(log.some((e) => e[0] === "changed" && e[1] === "downloading" && e[2] === 200));
  assert.deepEqual(log.at(-1), ["changed", "ready", 400]);
});

test("a second click while one is going starts nothing", async () => {
  const { s, log } = session();
  const first = s.start();
  await s.start();
  await first;
  assert.equal(log.filter((e) => e[0] === "download").length, 1);
});

test("skipping is offered before a download and not after", async () => {
  const { s } = session();
  assert.equal(s.canSkip(), true);
  const going = s.start();
  assert.equal(s.canSkip(), false);
  await going;
  assert.equal(s.canSkip(), false);
});

test("a failed download puts the notice back the way it was, with a reason", async () => {
  const { s } = session({ fail: "the connection ended after 200 of 400 bytes" });
  await s.start();
  assert.equal(s.stage, "idle");
  assert.equal(s.status().error, "the connection ended after 200 of 400 bytes");
  assert.equal(s.canSkip(), true);
  // And nothing was left ready to install.
  assert.equal(s.install(), false);
});

test("a failure can be tried again, and the second try clears the reason", async () => {
  let fail = "no";
  const log = [];
  const s = new UpdateSession(FOUND, null, {
    stage: (name) => name,
    async download() {
      if (fail) throw new Error(fail);
    },
    async prepare() {},
    apply: (file) => log.push(file),
    changed: () => {},
  });
  await s.start();
  assert.equal(s.status().error, "no");
  fail = "";
  await s.start();
  assert.equal(s.stage, "ready");
  assert.equal(s.status().error, null);
});

test("the restart is what installs, and only from ready", async () => {
  const { s, log } = session();
  assert.equal(s.install(), false);
  await s.start();
  assert.equal(s.install(), true);
  assert.deepEqual(log.at(-1), ["apply", "/tmp/AI4Kanban-0.9.0-arm64-mac.zip"]);
});

test("a copy that cannot replace itself downloads nothing", async () => {
  const { s, log } = session({ blocked: "AI4Kanban is running from a disk image." });
  await s.start();
  assert.equal(s.stage, "idle");
  assert.equal(s.status().blocked, "AI4Kanban is running from a disk image.");
  assert.deepEqual(log, []);
});
