// Whether a newer app is out, and installing it from inside this one (#372).
//
// The app downloads a new version on its own, the moment it knows there is one.
// Nothing is asked of the user until the bytes are on disk and checked, and
// nothing is written into place before the restart they pick. There is no manual
// path: a version that cannot be installed from inside the app is reported as a
// failure, not handed off to a downloads page.
//
// It is one path on all three systems: read the `latest*.yml` on the release,
// take the build for this system and architecture, check it against the sha512
// published beside it, and hand the swap to `install.ts`. The version the chip
// offers is the version in that file, so there is no second check to disagree
// with the first.
//
// A check that fails is not an error the user should see — no network, GitHub
// down, a rate limit, a release older than the updater. The app is running fine
// either way, so a failed check just means no news this time. A download that
// fails is different: the app retries it on a backoff, and only says so once it
// has given up.

import http from "node:http";
import https from "node:https";
import path from "node:path";
import { app } from "electron";
import type { UpdateFailure, UpdateStatus } from "../../shared/bridge";
import { fetchFile } from "./download";
import { UpdateFailed, failureOf, failureOfStatus } from "./failure";
import {
  LATEST_RELEASE_API,
  assetUrl,
  feedBase,
  feedFileName,
  feedIsOverridden,
  isNewer,
  parseFeed,
  pickBuild,
} from "./feed";
import {
  blockedReason,
  clearStage,
  detach,
  linuxSwapScript,
  macSwapScript,
  makeStage,
  runWindowsInstaller,
  stageDir,
  target,
  unpackMac,
  versionDir,
  type AppPlace,
  type Target,
} from "./install";
import { UpdateSession, verdictOn, type SessionHooks } from "./session";

export { DOWNLOADS_URL } from "./feed";
export type { UpdateStatus } from "../../shared/bridge";

const TIMEOUT_MS = 6000;

function get(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https;
    const req = client.get(url, { headers, timeout: TIMEOUT_MS }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        return resolve(get(new URL(location, url).toString(), headers));
      }
      if (status !== 200) {
        res.resume();
        return reject(new UpdateFailed(failureOfStatus(status)));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new UpdateFailed("timeout")));
    req.on("error", reject);
  });
}

/** The newest release's tag. Not the version the app installs — that comes out
 *  of the feed on this release — but which release to read it from. */
async function latestRelease(): Promise<{ tag: string } | null> {
  const body = await get(LATEST_RELEASE_API, {
    // GitHub's API refuses a request with no user agent.
    "User-Agent": "ai4kanban-desktop",
    Accept: "application/vnd.github+json",
  });
  const value: unknown = JSON.parse(body);
  if (!value || typeof value !== "object") return null;
  const release = value as { tag_name?: unknown };
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  return tag ? { tag } : null;
}

/** Where this app is, as `install.ts` reads it. */
function place(): AppPlace {
  return {
    platform: process.platform,
    packaged: app.isPackaged,
    exe: app.getPath("exe"),
    appImage: process.env.APPIMAGE ?? null,
  };
}

function hooksFor(t: Target, version: string, changed: () => void): SessionHooks {
  let dir: string | null = null;
  // What actually goes into place: the unpacked bundle on macOS, the file that
  // was downloaded everywhere else.
  let ready: string | null = null;
  return {
    stage(name) {
      if (!dir) {
        try {
          dir = makeStage(t, version);
        } catch (e) {
          // No room, or a folder this copy cannot write. Either way there is
          // nowhere to download to, and the category says which.
          throw new UpdateFailed(failureOf(e), e);
        }
      }
      return path.join(dir, name);
    },
    async download(url, into, expected, onProgress) {
      const got = await fetchFile(url, into, (p) => onProgress(p.received, p.total));
      if (expected && got.sha512 !== expected) throw new UpdateFailed("checksum");
    },
    async prepare(downloaded) {
      if (t.kind !== "mac") {
        ready = downloaded;
        return;
      }
      try {
        ready = await unpackMac(downloaded, path.join(versionDir(t, version), "app"));
      } catch (e) {
        throw new UpdateFailed(failureOf(e), e);
      }
    },
    apply(downloaded) {
      const file = ready ?? downloaded;
      if (t.kind === "windows") return runWindowsInstaller(file);
      if (t.kind === "mac") {
        return detach(
          macSwapScript({ pid: process.pid, bundle: t.bundle, staged: file, stage: stageDir(t) }),
          "ai4kanban-swap.sh",
        );
      }
      detach(
        linuxSwapScript({ pid: process.pid, file: t.file, staged: file, stage: stageDir(t) }),
        "ai4kanban-swap.sh",
      );
    },
    discard() {
      clearStage(t, version);
      // Forget the folder too, so a retry makes a fresh one rather than writing
      // into one that has been deleted.
      dir = null;
      ready = null;
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    changed,
  };
}

// --- the one session this launch has --------------------------------------

let session: UpdateSession | null = null;
const watchers = new Set<(status: UpdateStatus | null) => void>();

function announce(): void {
  const status = session?.status() ?? null;
  watchers.forEach((fn) => fn(status));
}

/** Be told each time the update moves, so the chip redraws. */
export function onUpdateChanged(fn: (status: UpdateStatus | null) => void): void {
  watchers.add(fn);
}

/** A download the user never restarted into is a bundle sitting beside the app.
 *  Nothing in this launch points at it, so the first check of the launch is
 *  where it goes — and the only place the whole staging folder is emptied, since
 *  from then on a version downloading into it may be one we still want. */
let swept = false;

async function look(currentVersion: string): Promise<UpdateSession | null> {
  const here = place();
  const t = target(here);
  if (t && !swept) {
    swept = true;
    try {
      clearStage(t);
    } catch {
      // A folder that will not be deleted is litter, not a reason to skip the check.
    }
  }
  const override = feedIsOverridden();
  const release = override ? null : await latestRelease();
  if (!override && !release) return null;
  const base = feedBase(release?.tag ?? null);
  if (!base) return null;

  let feed = null;
  try {
    feed = parseFeed(await get(assetUrl(base, feedFileName(process.platform, process.arch)), {}));
  } catch {
    // A release published before this app could install one carries no feed.
  }
  if (!feed) {
    // Only possible on a real release, where the tag is the version. There is
    // nothing here this app can install, and no manual path to offer instead.
    if (!release || !isNewer(release.tag, currentVersion)) return null;
    return blank(release.tag.replace(/^v/, ""), "noBuild");
  }
  if (!isNewer(feed.version, currentVersion)) return null;

  const file = pickBuild(feed, process.platform, process.arch);
  const blocked = blockedReason(here) ?? (file && t ? null : "noBuild");
  if (blocked || !file || !t) return blank(feed.version, blocked ?? "noBuild");

  const found = { version: feed.version, file, assetUrl: assetUrl(base, file.url) };
  return new UpdateSession(found, null, hooksFor(t, feed.version, announce));
}

/** A version this copy cannot put in place: the failure, and nothing to press. */
function blank(version: string, blocked: UpdateFailure): UpdateSession {
  const found = { version, file: { url: "", sha512: "", size: 0 }, assetUrl: "" };
  return new UpdateSession(found, blocked, {
    stage: (name) => name,
    download: async () => {},
    prepare: async () => {},
    apply: () => {},
    discard: () => {},
    wait: async () => {},
    changed: announce,
  });
}

/** Take this session as the current one and start it downloading. The download
 *  is not awaited: it runs for as long as it runs, retries included, and the
 *  chip follows it through `onUpdateChanged`. */
function adopt(found: UpdateSession | null): UpdateSession | null {
  session = found;
  announce();
  void found?.start();
  return found;
}

let looking: Promise<UpdateSession | null> | null = null;

/** Whether a newer app is out, asked once per launch and kept — the download
 *  belongs to the app, so every page that asks gets the same one, and the app
 *  itself asks at startup rather than waiting for a page to. */
export async function checkForUpdate(currentVersion: string): Promise<UpdateStatus | null> {
  if (!looking) {
    looking = look(currentVersion)
      .catch(() => null)
      .then(adopt);
  }
  await looking;
  return session?.status() ?? null;
}

/** Ask again, now — the menu's own Check for Updates…, which is the one place the
 *  answer is said out loud either way. What the answer means for the download
 *  already in hand is `verdictOn`. */
export async function recheckForUpdate(currentVersion: string): Promise<UpdateStatus | null> {
  const held = session;
  looking = look(currentVersion).catch(() => null);
  const found = await looking;
  switch (verdictOn(held, found)) {
    case "keep":
      return held?.status() ?? null;
    case "clear":
      return adopt(null)?.status() ?? null;
    case "supersede":
      held?.abandon();
      return adopt(found)?.status() ?? null;
    case "retry":
      return adopt(found)?.status() ?? null;
  }
}

/** Put the new version in place, if `version` is still the one that is ready.
 *  True when the app should now quit — nothing is written until it has. */
export function installUpdate(version: string): boolean {
  return session?.install(version) ?? false;
}
