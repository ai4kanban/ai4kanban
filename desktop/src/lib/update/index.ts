// Whether a newer app is out, and installing it from inside this one (#372).
//
// One click on the notice downloads the release and restarts into it. Nothing
// downloads before that click, nothing is written into place before the restart
// the user picks, and a failure at any step leaves the running app exactly as it
// was with the downloads page still on offer.
//
// It is one path on all three systems: read the `latest*.yml` on the release,
// take the build for this system and architecture, check it against the sha512
// published beside it, and hand the swap to `install.ts`. The version the notice
// offers is the version in that file, so there is no second check to disagree
// with the first.
//
// A check that fails is not an error the user should see — no network, GitHub
// down, a rate limit, a release older than the updater. The app is running fine
// either way, so a failed check just means no notice this time.

import http from "node:http";
import https from "node:https";
import path from "node:path";
import { app } from "electron";
import { copy } from "../copy";
import { fetchFile } from "./download";
import {
  DOWNLOADS_URL,
  LATEST_RELEASE_API,
  assetUrl,
  feedBase,
  feedFileName,
  feedIsOverridden,
  isNewer,
  parseFeed,
  pickBuild,
  type FeedFile,
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
  type AppPlace,
  type Target,
} from "./install";
import { UpdateSession, type SessionHooks, type UpdateStatus } from "./session";

export { DOWNLOADS_URL } from "./feed";
export type { UpdateStatus } from "./session";

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
        return reject(new Error(`the server answered ${status}`));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

/** The newest release's tag and page. Not the version the app installs — that
 *  comes out of the feed on this release — but which release to read it from. */
async function latestRelease(): Promise<{ tag: string; url: string } | null> {
  const body = await get(LATEST_RELEASE_API, {
    // GitHub's API refuses a request with no user agent.
    "User-Agent": "ai4kanban-desktop",
    Accept: "application/vnd.github+json",
  });
  const value: unknown = JSON.parse(body);
  if (!value || typeof value !== "object") return null;
  const release = value as { tag_name?: unknown; html_url?: unknown };
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  if (!tag) return null;
  return { tag, url: typeof release.html_url === "string" ? release.html_url : DOWNLOADS_URL };
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

function hooksFor(t: Target, changed: () => void): SessionHooks {
  let dir: string | null = null;
  // What actually goes into place: the unpacked bundle on macOS, the file that
  // was downloaded everywhere else.
  let ready: string | null = null;
  /** Throw away what a failed attempt left, and forget the folder it was in, so
   *  a second try makes a fresh one rather than writing into a folder that has
   *  been deleted. */
  const scrap = () => {
    clearStage(t);
    dir = null;
    ready = null;
  };
  return {
    stage(name) {
      if (!dir) dir = makeStage(t);
      return path.join(dir, name);
    },
    async download(url, into, expected, onProgress) {
      let got: { sha512: string };
      try {
        got = await fetchFile(url, into, (p) => onProgress(p.received, p.total));
      } catch (e) {
        scrap();
        throw new Error(copy().update.failedDownload(e instanceof Error ? e.message : String(e)));
      }
      if (expected && got.sha512 !== expected) {
        scrap();
        throw new Error(copy().update.failedChecksum);
      }
    },
    async prepare(downloaded) {
      if (t.kind !== "mac") {
        ready = downloaded;
        return;
      }
      try {
        ready = await unpackMac(downloaded, path.join(stageDir(t), "app"));
      } catch (e) {
        scrap();
        throw new Error(copy().update.failedUnpack(e instanceof Error ? e.message : String(e)));
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

/** Be told each time the download moves, so the notice redraws. */
export function onUpdateChanged(fn: (status: UpdateStatus | null) => void): void {
  watchers.add(fn);
}

async function look(currentVersion: string): Promise<UpdateSession | null> {
  const here = place();
  const t = target(here);
  // A download the user never restarted into is a bundle sitting beside the app.
  // Nothing in this launch points at it, so a fresh check is where it goes.
  if (t) {
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
  const url = release?.url ?? DOWNLOADS_URL;

  let feed = null;
  try {
    feed = parseFeed(await get(assetUrl(base, feedFileName(process.platform, process.arch)), {}));
  } catch {
    // A release published before this app could install one carries no feed.
  }
  if (!feed) {
    // Fall back to what the notice always said: a version, and a link. Only
    // possible on a real release, where the tag is the version.
    if (!release || !isNewer(release.tag, currentVersion)) return null;
    const version = release.tag.replace(/^v/, "");
    return blank(version, url, copy().update.failedRead);
  }
  if (!isNewer(feed.version, currentVersion)) return null;

  const file = pickBuild(feed, process.platform, process.arch);
  const blocked = blockedReason(here) ?? (file && t ? null : copy().update.noBuild);
  if (blocked || !file || !t) return blank(feed.version, url, blocked ?? copy().update.noBuild);

  const found = { version: feed.version, url, file, assetUrl: assetUrl(base, file.url) };
  return new UpdateSession(found, null, hooksFor(t, announce));
}

/** A version this copy can only link to: the notice, and no install. */
function blank(version: string, url: string, blocked: string): UpdateSession {
  const file: FeedFile = { url: "", sha512: "", size: 0 };
  return new UpdateSession({ version, url, file, assetUrl: "" }, blocked, {
    stage: (name) => name,
    download: async () => {},
    prepare: async () => {},
    apply: () => {},
    changed: announce,
  });
}

let looking: Promise<UpdateSession | null> | null = null;

/** Whether a newer app is out, asked once per launch and kept — the download
 *  belongs to the app, so every page that asks gets the same one. */
export async function checkForUpdate(currentVersion: string): Promise<UpdateStatus | null> {
  if (!looking) {
    looking = look(currentVersion)
      .catch(() => null)
      .then((found) => {
        session = found;
        return found;
      });
  }
  await looking;
  return session?.status() ?? null;
}

/** Ask again, now — the menu's own Check for Updates…, which is the one place
 *  the answer is said out loud either way. A download already going is kept:
 *  asking about it must not throw it away. */
export async function recheckForUpdate(currentVersion: string): Promise<UpdateStatus | null> {
  if (session && session.stage !== "idle") return session.status();
  looking = look(currentVersion)
    .catch(() => null)
    .then((found) => {
      session = found;
      return found;
    });
  await looking;
  announce();
  return session?.status() ?? null;
}

/** Waving a version off is offered only before a download starts. */
export function canSkipUpdate(): boolean {
  return session ? session.canSkip() : true;
}

export async function startUpdate(): Promise<UpdateStatus | null> {
  await session?.start();
  return session?.status() ?? null;
}

/** Put the new version in place. True when the app should now quit — nothing is
 *  written until it has. */
export function installUpdate(): boolean {
  return session?.install() ?? false;
}
