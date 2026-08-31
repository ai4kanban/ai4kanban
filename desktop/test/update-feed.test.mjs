// Which release, which build, and whether it is newer — the choices the install
// stands on, made without a network or a machine to run on.

import assert from "node:assert/strict";
import test from "node:test";
import {
  assetUrl,
  feedBase,
  feedFileName,
  feedIsOverridden,
  isNewer,
  parseFeed,
  pickBuild,
} from "../out/lib/update/feed.js";

// A `latest-mac.yml` as electron-builder writes one: both zips under `files:`,
// and a top-level `path:` naming the x64 build.
const MAC = `version: 0.9.0
files:
  - url: AI4Kanban-0.9.0-arm64-mac.zip
    sha512: ARM64SHA==
    size: 111
  - url: AI4Kanban-0.9.0-mac.zip
    sha512: X64SHA==
    size: 222
path: AI4Kanban-0.9.0-mac.zip
sha512: X64SHA==
releaseDate: '2026-08-31T00:00:00.000Z'
`;

const WIN = `version: 0.9.0
files:
  - url: AI4Kanban-Setup-0.9.0.exe
    sha512: EXESHA==
    size: 333
path: AI4Kanban-Setup-0.9.0.exe
sha512: EXESHA==
`;

test("reads a feed's version and every build in it", () => {
  const feed = parseFeed(MAC);
  assert.equal(feed.version, "0.9.0");
  assert.deepEqual(feed.files, [
    { url: "AI4Kanban-0.9.0-arm64-mac.zip", sha512: "ARM64SHA==", size: 111 },
    { url: "AI4Kanban-0.9.0-mac.zip", sha512: "X64SHA==", size: 222 },
  ]);
});

test("text that is not a feed is no feed", () => {
  assert.equal(parseFeed("<html>404</html>"), null);
  assert.equal(parseFeed(""), null);
});

test("macOS takes its architecture from files, never from path", () => {
  const feed = parseFeed(MAC);
  assert.equal(pickBuild(feed, "darwin", "arm64").url, "AI4Kanban-0.9.0-arm64-mac.zip");
  assert.equal(pickBuild(feed, "darwin", "x64").url, "AI4Kanban-0.9.0-mac.zip");
});

test("Windows and Linux take the one build their feed holds", () => {
  assert.equal(pickBuild(parseFeed(WIN), "win32", "x64").url, "AI4Kanban-Setup-0.9.0.exe");
  const linux = parseFeed(`version: 0.9.0
files:
  - url: AI4Kanban-0.9.0-arm64.AppImage
    sha512: APPSHA==
    size: 9
`);
  assert.equal(pickBuild(linux, "linux", "arm64").url, "AI4Kanban-0.9.0-arm64.AppImage");
});

test("a feed with no build for this machine offers none", () => {
  const onlyX64 = parseFeed(`version: 0.9.0
files:
  - url: AI4Kanban-0.9.0-mac.zip
    sha512: X64SHA==
    size: 1
`);
  assert.equal(pickBuild(onlyX64, "darwin", "arm64"), null);
});

test("each system reads its own latest file, and Linux one per architecture", () => {
  assert.equal(feedFileName("darwin", "arm64"), "latest-mac.yml");
  assert.equal(feedFileName("win32", "x64"), "latest.yml");
  assert.equal(feedFileName("linux", "x64"), "latest-linux.yml");
  assert.equal(feedFileName("linux", "arm64"), "latest-linux-arm64.yml");
});

test("a newer version is newer, and the same one is not", () => {
  assert.equal(isNewer("v0.9.0", "0.8.0"), true);
  assert.equal(isNewer("0.8.1", "0.8.0"), true);
  assert.equal(isNewer("0.8.0", "0.8.0"), false);
  assert.equal(isNewer("0.7.9", "0.8.0"), false);
  assert.equal(isNewer("1.2", "1.1.9"), true);
});

test("the release is the feed, unless the environment names another", () => {
  assert.equal(
    feedBase("v0.9.0", {}),
    "https://github.com/ai4kanban/ai4kanban/releases/download/v0.9.0/",
  );
  assert.equal(feedBase(null, {}), null);
  const env = { AI4KANBAN_UPDATE_FEED: "http://127.0.0.1:8099/dist" };
  assert.equal(feedBase("v0.9.0", env), "http://127.0.0.1:8099/dist/");
  assert.equal(feedIsOverridden(env), true);
  assert.equal(feedIsOverridden({}), false);
  assert.equal(feedIsOverridden({ AI4KANBAN_UPDATE_FEED: "  " }), false);
});

test("a build's url is named against the feed it came from", () => {
  assert.equal(assetUrl("http://127.0.0.1:8099/", "a.zip"), "http://127.0.0.1:8099/a.zip");
});
