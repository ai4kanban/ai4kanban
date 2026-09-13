// Where the app may replace itself, and where it must not.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import fs from "node:fs";
import {
  blockedReason,
  clearStage,
  macBundle,
  makeStage,
  stageDir,
  target,
  versionDir,
} from "../out/lib/update/install.js";

const yes = () => true;
const no = () => false;

const mac = (exe, packaged = true) => ({ platform: "darwin", packaged, exe, appImage: null });
const APP = "/Applications/AI4Kanban.app/Contents/MacOS/AI4Kanban";

test("a checkout has no app bundle to replace", () => {
  assert.equal(blockedReason(mac(APP, false), yes), "notInstallable");
});

test("an installed Mac app in a writable folder installs", () => {
  assert.equal(blockedReason(mac(APP), yes), null);
});

test("a Mac copy running off a disk image or translocated does not", () => {
  assert.equal(
    blockedReason(mac("/Volumes/AI4Kanban/AI4Kanban.app/Contents/MacOS/AI4Kanban"), yes),
    "notInstallable",
  );
  assert.equal(
    blockedReason(mac("/private/var/folders/x/AppTranslocation/ABC/d/AI4Kanban.app/Contents/MacOS/AI4Kanban"), yes),
    "notInstallable",
  );
});

test("a Mac bundle in a folder the user cannot write does not", () => {
  // A category, not a sentence — the folder it cannot write is an internal
  // detail, and every surface writes its own words for "read-only".
  assert.equal(blockedReason(mac(APP), no), "readOnly");
});

test("Downloads still installs — a swap leaves nothing behind to dangle", () => {
  const downloads = `${os.homedir()}/Downloads/AI4Kanban.app/Contents/MacOS/AI4Kanban`;
  assert.equal(blockedReason(mac(downloads), yes), null);
});

test("Linux installs as an AppImage and nothing else", () => {
  const asAppImage = { platform: "linux", packaged: true, exe: "/tmp/.mount_x/AI4Kanban", appImage: "/home/a/AI4Kanban.AppImage" };
  assert.equal(blockedReason(asAppImage, yes), null);
  assert.equal(blockedReason({ ...asAppImage, appImage: null }, yes), "notInstallable");
  assert.equal(blockedReason(asAppImage, no), "readOnly");
});

test("Windows installs wherever it is packaged", () => {
  const win = { platform: "win32", packaged: true, exe: "C:\\Users\\a\\AI4Kanban\\AI4Kanban.exe", appImage: null };
  assert.equal(blockedReason(win, no), null);
  assert.equal(blockedReason({ ...win, packaged: false }, yes), "notInstallable");
});

test("the bundle is the .app the executable sits inside", () => {
  assert.equal(macBundle(APP), "/Applications/AI4Kanban.app");
  assert.equal(macBundle("/usr/local/bin/akb"), null);
});

test("the download lands beside the app, so the swap is a rename", () => {
  const t = target(mac(APP));
  assert.deepEqual(t, { kind: "mac", bundle: "/Applications/AI4Kanban.app", parent: "/Applications" });
  assert.equal(stageDir(t), "/Applications/.ai4kanban-update");
  const linux = target({ platform: "linux", packaged: true, exe: "x", appImage: "/home/a/AI4Kanban.AppImage" });
  assert.equal(stageDir(linux), "/home/a/.ai4kanban-update");
  assert.equal(stageDir({ kind: "windows" }), path.join(os.tmpdir(), "ai4kanban-update"));
});

test("each version stages in a folder of its own", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "a4k-stage-"));
  const t = { kind: "linux", file: path.join(parent, "AI4Kanban.AppImage"), parent };
  const a = makeStage(t, "0.9.4");
  const b = makeStage(t, "0.9.5");
  assert.equal(a, versionDir(t, "0.9.4"));
  assert.notEqual(a, b);
  fs.writeFileSync(path.join(a, "build.zip"), "a");
  fs.writeFileSync(path.join(b, "build.zip"), "b");

  // Making one version's folder leaves the other's bytes alone — two downloads
  // can be in flight at once when a higher release supersedes one mid-flight.
  makeStage(t, "0.9.4");
  assert.equal(fs.existsSync(path.join(a, "build.zip")), false);
  assert.equal(fs.readFileSync(path.join(b, "build.zip"), "utf8"), "b");

  // And throwing one away takes only that one.
  clearStage(t, "0.9.5");
  assert.equal(fs.existsSync(b), false);
  assert.equal(fs.existsSync(a), true);

  // With no version, everything staged goes — what a launch does once.
  clearStage(t);
  assert.equal(fs.existsSync(stageDir(t)), false);
  fs.rmSync(parent, { recursive: true, force: true });
});
