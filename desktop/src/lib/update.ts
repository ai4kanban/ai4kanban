// Whether a newer app is out, and where to get it.
//
// The app never updates itself. It reads the project's newest GitHub release,
// compares the version, and — when there is a newer one — says so in the board's
// own notice line with a link to the downloads. What gets installed, and when,
// stays the user's call.
//
// A check that fails is not an error the user should see: no network, GitHub
// down, a rate limit. The app is running fine either way, so a failed check
// just means no notice this time.

import https from "node:https";
import type { UpdateInfo } from "../shared/bridge";

const LATEST_RELEASE_API = "https://api.github.com/repos/ai4kanban/ai4kanban/releases/latest";
/** Where a person goes to get the newer build. The releases page lists every
 *  build for every system, which is what "where to get it" means here. */
export const DOWNLOADS_URL = "https://github.com/ai4kanban/ai4kanban/releases/latest";

const TIMEOUT_MS = 6000;

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          // GitHub's API refuses a request with no user agent.
          "User-Agent": "ai4kanban-desktop",
          Accept: "application/vnd.github+json",
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GitHub answered ${res.statusCode}`));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

/** Compare two `1.2.3` versions. Anything after the numbers (a `-rc1`) is
 *  ignored — the app only ever asks "is the release newer than what I am". */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) =>
    String(v)
      .replace(/^v/, "")
      .split(/[.\-+]/)
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parts(candidate), parts(current)];
  for (let i = 0; i < 3; i++) {
    // A version with fewer parts than three reads as zero in the ones it is
    // missing, which is what `1.2` beating `1.1.9` means.
    const [x, y] = [a[i] ?? 0, b[i] ?? 0];
    if (x !== y) return x > y;
  }
  return false;
}

/** The release JSON, trusted no further than the two fields we read off it. */
function releaseOf(value: unknown): { tag: string; url: string } | null {
  if (!value || typeof value !== "object") return null;
  const release = value as { tag_name?: unknown; html_url?: unknown };
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  if (!tag) return null;
  return { tag, url: typeof release.html_url === "string" ? release.html_url : DOWNLOADS_URL };
}

/**
 * `{ version, url }` when a newer release is out, or null — including when the
 * check simply couldn't be made.
 */
export async function newerRelease(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const release = releaseOf(await getJson(LATEST_RELEASE_API));
    if (!release || !isNewer(release.tag, currentVersion)) return null;
    return { version: release.tag.replace(/^v/, ""), url: release.url };
  } catch {
    return null;
  }
}
