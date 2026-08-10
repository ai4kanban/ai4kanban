"use strict";

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

const https = require("node:https");

const LATEST_RELEASE_API = "https://api.github.com/repos/ai4kanban/ai4kanban/releases/latest";
/** Where a person goes to get the newer build. The releases page lists every
 *  build for every system, which is what "where to get it" means here. */
const DOWNLOADS_URL = "https://github.com/ai4kanban/ai4kanban/releases/latest";

const TIMEOUT_MS = 6000;

function getJson(url) {
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
function isNewer(candidate, current) {
  const parts = (v) => String(v).replace(/^v/, "").split(/[.\-+]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parts(candidate), parts(current)];
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/**
 * `{ version, url }` when a newer release is out, or null — including when the
 * check simply couldn't be made.
 */
async function newerRelease(currentVersion) {
  try {
    const release = await getJson(LATEST_RELEASE_API);
    const tag = typeof release?.tag_name === "string" ? release.tag_name : "";
    if (!tag || !isNewer(tag, currentVersion)) return null;
    return { version: tag.replace(/^v/, ""), url: release.html_url || DOWNLOADS_URL };
  } catch {
    return null;
  }
}

module.exports = { newerRelease, isNewer, DOWNLOADS_URL };
