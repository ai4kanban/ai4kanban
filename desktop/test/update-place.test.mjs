// Where the app may replace itself, and where it must not.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { blockedReason, macBundle, stageDir, target } from "../out/lib/update/install.js";

const yes = () => true;
const no = () => false;

const mac = (exe, packaged = true) => ({ platform: "darwin", packaged, exe, appImage: null });
const APP = "/Applications/AI4Kanban.app/Contents/MacOS/AI4Kanban";

test("a checkout has no app bundle to replace", () => {
  assert.match(blockedReason(mac(APP, false), yes), /build from source/);
});

test("an installed Mac app in a writable folder installs", () => {
  assert.equal(blockedReason(mac(APP), yes), null);
});

test("a Mac copy running off a disk image or translocated does not", () => {
  assert.match(blockedReason(mac("/Volumes/AI4Kanban/AI4Kanban.app/Contents/MacOS/AI4Kanban"), yes), /disk image/);
  assert.match(
    blockedReason(mac("/private/var/folders/x/AppTranslocation/ABC/d/AI4Kanban.app/Contents/MacOS/AI4Kanban"), yes),
    /temporary copy/,
  );
});

test("a Mac bundle in a folder the user cannot write does not", () => {
  const why = blockedReason(mac(APP), no);
  assert.match(why, /cannot write/);
  assert.match(why, /\/Applications/);
});

test("Downloads still installs — a swap leaves nothing behind to dangle", () => {
  const downloads = `${os.homedir()}/Downloads/AI4Kanban.app/Contents/MacOS/AI4Kanban`;
  assert.equal(blockedReason(mac(downloads), yes), null);
});

test("Linux installs as an AppImage and nothing else", () => {
  const asAppImage = { platform: "linux", packaged: true, exe: "/tmp/.mount_x/AI4Kanban", appImage: "/home/a/AI4Kanban.AppImage" };
  assert.equal(blockedReason(asAppImage, yes), null);
  assert.match(blockedReason({ ...asAppImage, appImage: null }, yes), /not running as an AppImage/);
  assert.match(blockedReason(asAppImage, no), /cannot write/);
});

test("Windows installs wherever it is packaged", () => {
  const win = { platform: "win32", packaged: true, exe: "C:\\Users\\a\\AI4Kanban\\AI4Kanban.exe", appImage: null };
  assert.equal(blockedReason(win, no), null);
  assert.match(blockedReason({ ...win, packaged: false }, yes), /build from source/);
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
