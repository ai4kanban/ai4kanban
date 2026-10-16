// A slide's preview may be an HTML/TSX page on the deck's canvas (#1742); a shot's frames stay pictures.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { build } from "esbuild";

const UI = new URL("..", import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(UI, ".test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const out = path.join(tmp, "storyboard-check.mjs");
await build({ entryPoints: [path.join(UI, "lib/storyboard-check.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
const { checkStoryboard } = await import(out);

const png = (width) => {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47], 0);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, 1);
  return b;
};
const slide = (id, src) => ({ id, title: id, copy: [], layout: "title", assets: [], preview: { src, alt: id } });
const files = { "cover.png": png(800), "pages/intro.html": new Uint8Array([1]), "pages/chart.tsx": new Uint8Array([1]) };
const check = (data) =>
  checkStoryboard(JSON.stringify(data), { file: "s.json", cardId: 1, read: (name) => files[name] ?? null });
const codes = (r) => r.diagnostics.map((d) => `${d.pointer} ${d.code}`);

test("a slide preview may be an image, an .html page or a .tsx page, in a subfolder", () => {
  const r = check({
    version: 1,
    size: { width: 1024, height: 768 },
    slides: [slide("cover", ".assets/1/cover.png"), slide("intro", ".assets/1/pages/intro.html"), slide("chart", ".assets/1/pages/chart.tsx")],
  });
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.storyboard.size, { width: 1024, height: 768 });
});

test("a missing page still draws the deck", () => {
  const r = check({ version: 1, slides: [slide("gone", ".assets/1/gone.html")] });
  assert.deepEqual(codes(r), ["/slides/0/preview/src frame-missing"]);
  assert.ok(r.storyboard);
});

test("a shot's frame is never a page", () => {
  const shot = { id: "S1", start: 0, end: 1, voiceover: { mode: "none" }, action: "a", captions: [], details: "d", frames: [{ src: ".assets/1/intro.html", alt: "a" }] };
  assert.deepEqual(codes(check({ version: 1, shots: [shot] })), ["/shots/0/frames/0/src frame-path"]);
});

test("size takes whole positive width and height and nothing else", () => {
  const deck = (size) => codes(check({ version: 1, size, slides: [slide("cover", ".assets/1/cover.png")] }));
  assert.deepEqual(deck({ width: 0, height: 1.5 }), ["/size/width invalid-value", "/size/height invalid-value"]);
  assert.deepEqual(deck({ width: 4, height: 3, depth: 1 }), ["/size/depth unknown-field"]);
  assert.deepEqual(deck([4, 3]), ["/size invalid-value"]);
  assert.equal(check({ version: 1, size: { width: 4 }, slides: [] }).storyboard, null);
});
