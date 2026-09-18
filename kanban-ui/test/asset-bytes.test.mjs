// The asset route's bytes (#872): whole, one range, past the end, and what it refuses.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { serveAsset } from "../lib/asset-bytes.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-bytes-"));
fs.mkdirSync(path.join(root, "872"));
const bytes = Buffer.from("0123456789");
fs.writeFileSync(path.join(root, "872", "clip.mp4"), bytes);
fs.writeFileSync(path.join(root, "872", "notes.exe"), bytes);
fs.writeFileSync(path.join(root, "secret.mp3"), bytes);
const serve = (folder, name, range = null) => serveAsset([root], folder, name, range);
const body = async (res) => Buffer.from(await res.arrayBuffer()).toString();

test("the whole file", async () => {
  const res = serve("872", "clip.mp4");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "video/mp4");
  assert.equal(res.headers.get("accept-ranges"), "bytes");
  assert.equal(res.headers.get("content-length"), "10");
  assert.equal(await body(res), "0123456789");
});

test("one range", async () => {
  const res = serve("872", "clip.mp4", "bytes=2-5");
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(res.headers.get("content-length"), "4");
  assert.equal(await body(res), "2345");
  assert.equal(await body(serve("872", "clip.mp4", "bytes=7-")), "789");
  assert.equal(await body(serve("872", "clip.mp4", "bytes=-3")), "789");
  assert.equal(serve("872", "clip.mp4", "bytes=8-99").headers.get("content-range"), "bytes 8-9/10");
});

test("a range past the end", () => {
  const res = serve("872", "clip.mp4", "bytes=10-");
  assert.equal(res.status, 416);
  assert.equal(res.headers.get("content-range"), "bytes */10");
});

test("nothing outside the card's folder, nothing of another type", () => {
  assert.equal(serve("..", "secret.mp3").status, 404);
  assert.equal(serve("872", "../secret.mp3").status, 404);
  assert.equal(serve(".", "secret.mp3").status, 404);
  assert.equal(serve("872", "notes.exe").status, 404);
  assert.equal(serve("872", "gone.mp4").status, 404);
});
