// The swap itself, run for real in a temp folder: the app goes into place, and a
// swap that fails partway puts back the version the user was running.
//
// The scripts take their reopen command as a parameter, so a test can watch for
// the relaunch without launching anything.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { linuxSwapScript, macSwapScript } from "../out/lib/update/install.js";

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "a4k-swap-"));
  const opened = path.join(root, "opened");
  // Stands in for `open`: writes down what it was asked to reopen.
  const opener = path.join(root, "open.sh");
  fs.writeFileSync(opener, `#!/bin/sh\nprintf '%s' "$1" > ${JSON.stringify(opened)}\n`, { mode: 0o755 });
  return { root, opened, opener };
}

/** A pid that has certainly exited, so the helper never waits. */
const GONE = 2147480000;

function run(script, root) {
  const file = path.join(root, "swap.sh");
  fs.writeFileSync(file, script, { mode: 0o755 });
  try {
    execFileSync("/bin/sh", [file], { stdio: "pipe" });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

test("the Mac swap puts the new bundle at the path the old one had", () => {
  const { root, opened, opener } = sandbox();
  const bundle = path.join(root, "AI4Kanban.app");
  const stage = path.join(root, ".ai4kanban-update");
  const staged = path.join(stage, "app", "AI4Kanban.app");
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, "version"), "0.8.0");
  fs.mkdirSync(staged, { recursive: true });
  fs.writeFileSync(path.join(staged, "version"), "0.9.0");

  const code = run(macSwapScript({ pid: GONE, bundle, staged, stage }, opener), root);

  assert.equal(code, 0);
  assert.equal(fs.readFileSync(path.join(bundle, "version"), "utf8"), "0.9.0");
  assert.equal(fs.existsSync(`${bundle}.old`), false, "the old bundle is not left behind");
  assert.equal(fs.existsSync(stage), false, "the staging folder is cleared");
  assert.equal(fs.readFileSync(opened, "utf8"), bundle, "the app at that path is reopened");
});

test("a Mac swap that fails partway puts the old bundle back and reopens it", () => {
  const { root, opened, opener } = sandbox();
  const bundle = path.join(root, "AI4Kanban.app");
  const stage = path.join(root, ".ai4kanban-update");
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, "version"), "0.8.0");
  // The new bundle is gone by the time the swap runs — the old one has already
  // been moved aside when the second move fails.
  const staged = path.join(stage, "app", "AI4Kanban.app");
  fs.mkdirSync(stage, { recursive: true });

  const code = run(macSwapScript({ pid: GONE, bundle, staged, stage }, opener), root);

  assert.equal(code, 1);
  assert.equal(fs.readFileSync(path.join(bundle, "version"), "utf8"), "0.8.0");
  assert.equal(fs.existsSync(`${bundle}.old`), false);
  assert.equal(fs.readFileSync(opened, "utf8"), bundle, "the version that was running starts next time");
});

test("the Linux swap replaces the AppImage at the path it was launched from", () => {
  const { root, opened, opener } = sandbox();
  const file = path.join(root, "AI4Kanban.AppImage");
  const stage = path.join(root, ".ai4kanban-update");
  const staged = path.join(stage, "AI4Kanban-0.9.0.AppImage");
  fs.writeFileSync(file, "0.8.0", { mode: 0o755 });
  fs.mkdirSync(stage, { recursive: true });
  fs.writeFileSync(staged, "0.9.0");

  const code = run(linuxSwapScript({ pid: GONE, file, staged, stage }, `${opener} "$APP"`), root);

  assert.equal(code, 0);
  assert.equal(fs.readFileSync(file, "utf8"), "0.9.0");
  assert.ok(fs.statSync(file).mode & 0o111, "the new AppImage is executable");
  assert.equal(fs.existsSync(`${file}.old`), false);
  assert.equal(fs.readFileSync(opened, "utf8"), file, "$APPIMAGE still names the file that was launched");
});

test("a Linux swap that fails partway leaves the running version in place", () => {
  const { root, opened, opener } = sandbox();
  const file = path.join(root, "AI4Kanban.AppImage");
  const stage = path.join(root, ".ai4kanban-update");
  fs.writeFileSync(file, "0.8.0", { mode: 0o755 });
  fs.mkdirSync(stage, { recursive: true });

  const code = run(
    linuxSwapScript({ pid: GONE, file, staged: path.join(stage, "missing"), stage }, `${opener} "$APP"`),
    root,
  );

  assert.equal(code, 1);
  assert.equal(fs.readFileSync(file, "utf8"), "0.8.0");
  assert.equal(fs.readFileSync(opened, "utf8"), file);
});

test("a swap never runs while the app it replaces is still up", () => {
  const { root, opener } = sandbox();
  const bundle = path.join(root, "AI4Kanban.app");
  const stage = path.join(root, ".ai4kanban-update");
  fs.mkdirSync(bundle);
  fs.writeFileSync(path.join(bundle, "version"), "0.8.0");
  fs.mkdirSync(path.join(stage, "app", "AI4Kanban.app"), { recursive: true });

  // This process is very much alive, so the helper waits it out and gives up
  // rather than replacing a bundle something is reading from. Two minutes is
  // too long for a test, so the wait is cut to one turn.
  const script = macSwapScript(
    { pid: process.pid, bundle, staged: path.join(stage, "app", "AI4Kanban.app"), stage },
    opener,
  ).replace('"$i" -lt 480', '"$i" -lt 1');

  assert.equal(run(script, root), 1);
  assert.equal(fs.readFileSync(path.join(bundle, "version"), "utf8"), "0.8.0");
});
