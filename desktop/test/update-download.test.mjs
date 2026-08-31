// Fetching a build: the bytes, the hash the release published, and the two ways
// a download does not finish.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fetchFile } from "../out/lib/update/download.js";

const BODY = Buffer.from("a".repeat(4096));
const SHA = crypto.createHash("sha512").update(BODY).digest("base64");

function serve(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function tmp(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a4k-dl-"));
  return path.join(dir, name);
}

test("a whole download hashes to what the release published", async () => {
  const { server, port } = await serve((_req, res) => {
    res.writeHead(200, { "content-length": String(BODY.length) });
    res.end(BODY);
  });
  const file = tmp("build.zip");
  const seen = [];
  const got = await fetchFile(
    `http://127.0.0.1:${port}/build.zip`,
    file,
    (p) => seen.push(p.received),
    new AbortController().signal,
  );
  server.close();
  assert.equal(got.sha512, SHA);
  assert.equal(got.size, BODY.length);
  assert.equal(fs.statSync(file).size, BODY.length);
  assert.ok(seen.length > 0);
  assert.equal(seen.at(-1), BODY.length);
});

test("a download that is cut off says how far it got", async () => {
  const { server, port } = await serve((_req, res) => {
    res.writeHead(200, { "content-length": String(BODY.length) });
    res.write(BODY.subarray(0, 1000));
    // The connection drops with the file half written — which ends the stream
    // cleanly, so the byte count is what catches it.
    res.destroy();
  });
  await assert.rejects(
    fetchFile(
      `http://127.0.0.1:${port}/build.zip`,
      tmp("build.zip"),
      () => {},
      new AbortController().signal,
    ),
    /of 4096 bytes|aborted|socket hang up|ECONNRESET/,
  );
  server.close();
});

test("a build that is not there is not a build", async () => {
  const { server, port } = await serve((_req, res) => {
    res.writeHead(404);
    res.end("no");
  });
  await assert.rejects(
    fetchFile(
      `http://127.0.0.1:${port}/gone.zip`,
      tmp("gone.zip"),
      () => {},
      new AbortController().signal,
    ),
    /answered 404/,
  );
  server.close();
});

test("a redirect is followed, the way a release asset answers", async () => {
  const { server, port } = await serve((req, res) => {
    if (req.url === "/asset") {
      res.writeHead(302, { location: "/storage" });
      return res.end();
    }
    res.writeHead(200, { "content-length": String(BODY.length) });
    res.end(BODY);
  });
  const got = await fetchFile(
    `http://127.0.0.1:${port}/asset`,
    tmp("build.zip"),
    () => {},
    new AbortController().signal,
  );
  server.close();
  assert.equal(got.sha512, SHA);
});

test("bytes that do not match the published sha512 are caught by the hash", async () => {
  const { server, port } = await serve((_req, res) => {
    const other = Buffer.from("b".repeat(4096));
    res.writeHead(200, { "content-length": String(other.length) });
    res.end(other);
  });
  const got = await fetchFile(
    `http://127.0.0.1:${port}/build.zip`,
    tmp("build.zip"),
    () => {},
    new AbortController().signal,
  );
  server.close();
  assert.notEqual(got.sha512, SHA);
});
