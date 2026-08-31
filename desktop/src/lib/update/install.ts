// Where this app is, whether it may replace itself there, and how it does it.
//
// Three systems, three swaps, one shape: nothing is written into place until
// the running app has exited, and a swap that fails partway puts the version
// the user was running back. macOS and Linux hand the move to a small shell
// script that outlives the app; Windows hands it to the same NSIS installer a
// person would have run, which is what reruns `path.ps1` and leaves `akb`
// pointing at the new version.
//
// macOS replaces its own bundle rather than going through the system's updater.
// Squirrel.Mac checks that the new bundle satisfies the running app's designated
// signing requirement, and an ad-hoc signature is derived from the build's own
// hash — so no two builds share a requirement and that check can never pass.
// The requirement is Squirrel's, not the system's: macOS places no signature
// condition on an application rewriting files it has permission to write.
//
// Nothing here imports Electron. What the app knows about itself arrives as an
// `AppPlace`, so every refusal and every script below can be checked on its own.

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copy } from "../copy";

/** What the app knows about where it is running. */
export interface AppPlace {
  platform: NodeJS.Platform;
  /** False in a checkout — there is no app bundle to replace yet. */
  packaged: boolean;
  /** The executable this process is running as. */
  exe: string;
  /** `$APPIMAGE` — the file a Linux user launched. Null when this is not one. */
  appImage: string | null;
}

/** What replacing this app means on this system. */
export type Target =
  | { kind: "mac"; bundle: string; parent: string }
  | { kind: "windows" }
  | { kind: "linux"; file: string; parent: string };

/** The `.app` a Mac executable is inside, or null when it is in none. */
export function macBundle(exe: string): string | null {
  const parts = exe.split(path.sep);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.endsWith(".app")) return parts.slice(0, i + 1).join(path.sep);
  }
  return null;
}

function writable(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Why this copy cannot install a new version over itself, or null when it can.
 *
 * The three Mac cases are the ones `lib/command.ts` already refuses a symlink
 * for, less Downloads: a link there dies when the user moves the file, while a
 * swap has nothing to leave behind — it writes where the app already is.
 */
export function blockedReason(place: AppPlace, canWrite: (dir: string) => boolean = writable): string | null {
  const c = copy();
  if (!place.packaged) return c.update.blockedSource;
  if (place.platform === "win32") return null;
  if (place.platform === "linux") {
    if (!place.appImage) return c.update.blockedNotAppImage;
    return canWrite(path.dirname(place.appImage)) ? null : c.update.blockedReadOnly(path.dirname(place.appImage));
  }
  if (place.platform !== "darwin") return c.update.blockedNotAppImage;
  if (place.exe.startsWith("/Volumes/")) return c.command.blockedImage;
  if (place.exe.includes("/AppTranslocation/")) return c.command.blockedTranslocated;
  const bundle = macBundle(place.exe);
  if (!bundle) return c.update.blockedSource;
  const parent = path.dirname(bundle);
  return canWrite(parent) ? null : c.update.blockedReadOnly(parent);
}

/** What a swap moves, once `blockedReason` has said it may. */
export function target(place: AppPlace): Target | null {
  if (place.platform === "win32") return { kind: "windows" };
  if (place.platform === "linux") {
    if (!place.appImage) return null;
    return { kind: "linux", file: place.appImage, parent: path.dirname(place.appImage) };
  }
  const bundle = macBundle(place.exe);
  if (!bundle) return null;
  return { kind: "mac", bundle, parent: path.dirname(bundle) };
}

/** Where the download lands. Beside the app on macOS and Linux, so the swap is a
 *  rename on the one filesystem rather than a copy at quitting time; the
 *  system's temp folder on Windows, where an installer is only ever read. */
export function stageDir(t: Target): string {
  if (t.kind === "windows") return path.join(os.tmpdir(), "ai4kanban-update");
  return path.join(t.parent, ".ai4kanban-update");
}

export function makeStage(t: Target): string {
  const dir = stageDir(t);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function clearStage(t: Target): void {
  fs.rmSync(stageDir(t), { recursive: true, force: true });
}

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, (err, _stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).trim()));
      else resolve();
    });
  });
}

/**
 * Unpack the Mac zip and hand back the bundle inside it.
 *
 * `ditto -xk` rather than `unzip`: the Electron framework is a tree of symlinks
 * and only ditto keeps them. Quarantine is cleared on what lands, so the
 * restart raises none of the warnings a browser download does — the app put it
 * there itself.
 */
export async function unpackMac(zip: string, into: string): Promise<string> {
  await run("/usr/bin/ditto", ["-xk", zip, into]);
  const bundle = fs.readdirSync(into).find((name) => name.endsWith(".app"));
  if (!bundle) throw new Error("the download held no application");
  const app = path.join(into, bundle);
  // Best effort: a build with no quarantine flag to clear is the ordinary case.
  await run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", app]).catch(() => {});
  return app;
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** How long a helper waits for the app to go before giving up: two minutes, in
 *  quarter seconds. A quit that takes longer than that is a quit that failed,
 *  and a swap under a live app is the one thing never worth risking. */
const WAIT = `i=0
while [ "$i" -lt 480 ] && kill -0 "$PID" 2>/dev/null; do
  sleep 0.25
  i=$((i + 1))
done
if kill -0 "$PID" 2>/dev/null; then
  exit 1
fi`;

/**
 * The script that swaps a Mac bundle once the app has gone.
 *
 * Move the old one aside, move the new one into the same path, reopen it. Any
 * step that fails puts the old bundle back and reopens that instead, so the
 * version the user was running is what starts next time. `opener` is a
 * parameter so the swap can be exercised without launching anything.
 */
export function macSwapScript(
  args: { pid: number; bundle: string; staged: string; stage: string },
  opener = "/usr/bin/open",
): string {
  const backup = `${args.bundle}.old`;
  return `#!/bin/sh
# Put the new AI4Kanban in place, once the old one has quit (#372).
set -u
PID=${args.pid}
APP=${quote(args.bundle)}
NEW=${quote(args.staged)}
BACKUP=${quote(backup)}
STAGE=${quote(args.stage)}

${WAIT}

rm -rf "$BACKUP"
if ! mv "$APP" "$BACKUP"; then
  rm -rf "$STAGE"
  exit 1
fi
if mv "$NEW" "$APP"; then
  rm -rf "$BACKUP" "$STAGE"
  ${opener} "$APP"
  exit 0
fi
mv "$BACKUP" "$APP"
rm -rf "$STAGE"
${opener} "$APP"
exit 1
`;
}

/** The same swap for an AppImage, which is one file at `$APPIMAGE`. */
export function linuxSwapScript(
  args: { pid: number; file: string; staged: string; stage: string },
  opener = "",
): string {
  const backup = `${args.file}.old`;
  const launch = opener || `"$APP" &`;
  return `#!/bin/sh
# Put the new AI4Kanban in place, once the old one has quit (#372).
set -u
PID=${args.pid}
APP=${quote(args.file)}
NEW=${quote(args.staged)}
BACKUP=${quote(backup)}
STAGE=${quote(args.stage)}

${WAIT}

rm -f "$BACKUP"
if ! mv "$APP" "$BACKUP"; then
  rm -rf "$STAGE"
  exit 1
fi
if mv "$NEW" "$APP"; then
  chmod +x "$APP"
  rm -f "$BACKUP"
  rm -rf "$STAGE"
  ${launch}
  exit 0
fi
mv "$BACKUP" "$APP"
rm -rf "$STAGE"
${launch}
exit 1
`;
}

/** Leave the script running after this process is gone. It lives in the system's
 *  temp folder rather than in the staging folder it deletes: a shell reads a
 *  script as it goes, and one that deletes itself mid-run is a swap that stops
 *  halfway. */
export function detach(script: string, name: string): void {
  const file = path.join(os.tmpdir(), name);
  fs.writeFileSync(file, script, { mode: 0o755 });
  spawn("/bin/sh", [file], { detached: true, stdio: "ignore" }).unref();
}

/** Windows hands the swap to the installer the user would have run. `--updated`
 *  is what makes `customInstall` fire, so `path.ps1 -Add` rewrites the PATH
 *  entry and `akb` keeps answering; `/S` runs it without a window, and
 *  `--force-run` opens the new version when it is done. */
export function runWindowsInstaller(installer: string): void {
  spawn(installer, ["--updated", "/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
}
