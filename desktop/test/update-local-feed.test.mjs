// The whole path against a folder standing in for a release, which is what the
// environment override is for: a `desktop/dist/` served over http is a feed, and
// nothing has to be published to exercise the install.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fetchFile } from "../out/lib/update/download.js";
import { assetUrl, feedBase, feedFileName, parseFeed, pickBuild } from "../out/lib/update/feed.js";
import { UpdateSession } from "../out/lib/update/session.js";

/** A folder shaped like `desktop/dist/` after `npm run dist:mac`. */
function dist({ corrupt = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a4k-dist-"));
  const name = "AI4Kanban-0.9.0-arm64-mac.zip";
  const body = Buffer.from("the arm64 build".repeat(64));
  const sha512 = crypto.createHash("sha512").update(body).digest("base64");
  fs.writeFileSync(path.join(dir, name), corrupt ? Buffer.concat([body, Buffer.from("x")]) : body);
  fs.writeFileSync(
    path.join(dir, "latest-mac.yml"),
    `version: 0.9.0
files:
  - url: ${name}
    sha512: ${sha512}
    size: ${body.length}
  - url: AI4Kanban-0.9.0-mac.zip
    sha512: OTHER==
    size: 1
path: AI4Kanban-0.9.0-mac.zip
sha512: OTHER==
`,
  );
  return { dir, name };
}

function serve(dir) {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url ?? "").replace(/^\//, ""));
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, { "content-length": String(body.length) });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` }));
  });
}

async function text(url) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a4k-yml-")), "feed.yml");
  await fetchFile(url, file, () => {}, new AbortController().signal);
  return fs.readFileSync(file, "utf8");
}

/** Everything an install does, from the feed to a session that is ready. */
async function install(base) {
  const feed = parseFeed(await text(assetUrl(base, feedFileName("darwin", "arm64"))));
  const file = pickBuild(feed, "darwin", "arm64");
  const found = { version: feed.version, url: "https://example.invalid", file, assetUrl: assetUrl(base, file.url) };
  const into = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a4k-stage-")), file.url);
  const session = new UpdateSession(found, null, {
    stage: () => into,
    async download(url, target, expected, onProgress) {
      const got = await fetchFile(url, target, (p) => onProgress(p.received, p.total), new AbortController().signal);
      if (got.sha512 !== expected) throw new Error("checksum");
    },
    async prepare() {},
    apply: () => {},
    changed: () => {},
  });
  await session.start();
  return { session, feed, file, into };
}

test("a served dist folder installs end to end", async () => {
  const { dir } = dist();
  const { server, base } = await serve(dir);
  assert.equal(feedBase(null, { AI4KANBAN_UPDATE_FEED: base }), base);

  const { session, feed, file, into } = await install(base);
  server.close();

  assert.equal(feed.version, "0.9.0");
  assert.equal(file.url, "AI4Kanban-0.9.0-arm64-mac.zip", "the arm64 build, not the one path names");
  assert.equal(session.stage, "ready");
  assert.equal(session.status().error, null);
  assert.equal(fs.statSync(into).size, file.size);
});

test("a build that does not match its published sha512 installs nothing", async () => {
  const { dir } = dist({ corrupt: true });
  const { server, base } = await serve(dir);
  const { session } = await install(base);
  server.close();
  assert.equal(session.stage, "idle");
  assert.equal(session.status().error, "checksum");
  assert.equal(session.install(), false);
});

test("a feed with nothing behind it offers nothing", async () => {
  const { server, base } = await serve(fs.mkdtempSync(path.join(os.tmpdir(), "a4k-empty-")));
  await assert.rejects(text(assetUrl(base, "latest-mac.yml")), /answered 404/);
  server.close();
});
