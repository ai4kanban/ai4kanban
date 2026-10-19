#!/usr/bin/env node
// Pixel-by-pixel diff of a source and a clone screenshot at their native size, in headless
// Chrome over CDP: no scaling, no greyscale, no dependencies.
//
//   node pixel-diff.mjs <source.png> <clone.png> --regions <regions.json> --out <heatmap.png>
//
// regions.json: [{ "name": "nav", "x": 0, "y": 0, "width": 1440, "height": 64 }, ...] in image
// pixels. Prints JSON: per region the differing pixel count, ratio and their bounding box,
// plus `outside` for differences no region covers. Exits 1 when the two sizes differ.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function fail(message) {
  console.error(`pixel-diff: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const files = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) opts[argv[i].slice(2)] = argv[++i];
    else files.push(argv[i]);
  }
  if (files.length !== 2 || !opts.out) {
    fail("usage: pixel-diff.mjs <source.png> <clone.png> --out <heatmap.png> [--regions <regions.json>]");
  }
  const regions = opts.regions ? JSON.parse(readFileSync(opts.regions, "utf8")) : [];
  for (const r of regions) {
    if (typeof r.name !== "string" || ![r.x, r.y, r.width, r.height].every(Number.isInteger)) {
      fail(`region needs a name and integer x, y, width, height: ${JSON.stringify(r)}`);
    }
  }
  return { source: files[0], clone: files[1], out: opts.out, regions };
}

async function launchChrome() {
  const bin = CHROME_PATHS.find((p) => existsSync(p));
  if (!bin) fail("Chrome not found; set CHROME to its executable");
  const profile = mkdtempSync(join(tmpdir(), "pixel-diff-"));
  const chrome = spawn(
    bin,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"],
    { stdio: "ignore" },
  );
  // fail() exits straight away, so cleanup hangs on exit rather than on a finally.
  process.on("exit", () => {
    chrome.kill("SIGKILL");
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    } catch {}
  });
  const portFile = join(profile, "DevToolsActivePort");
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await new Promise((r) => setTimeout(r, 100));
    port = existsSync(portFile) && readFileSync(portFile, "utf8").split("\n")[0];
  }
  if (!port) fail("Chrome did not start");
  return port;
}

async function connect(port) {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    page = targets.find((t) => t.type === "page");
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) fail("no page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const evaluate = (expression) =>
    new Promise((resolve) => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    }).then((msg) => {
      const r = msg.result;
      if (msg.error || r.exceptionDetails) fail(msg.error?.message ?? r.exceptionDetails.exception?.description);
      return r.result.value;
    });
  return { evaluate, close: () => ws.close() };
}

// Runs in the page. Decodes without colour conversion so pixels are the file's own values.
function compareInPage(sourceB64, cloneB64, regions) {
  const decode = async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  };
  return Promise.all([decode(sourceB64), decode(cloneB64)]).then(async ([a, b]) => {
    if (a.width !== b.width || a.height !== b.height) {
      return { sizeMismatch: { source: [a.width, a.height], clone: [b.width, b.height] } };
    }
    const { width, height } = a;
    const heat = new ImageData(width, height);
    const stats = regions.map((r) => ({ ...r, diff: 0, minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 }));
    const outside = { diff: 0, minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };
    let total = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const delta = Math.max(
          Math.abs(a.data[i] - b.data[i]),
          Math.abs(a.data[i + 1] - b.data[i + 1]),
          Math.abs(a.data[i + 2] - b.data[i + 2]),
          Math.abs(a.data[i + 3] - b.data[i + 3]),
        );
        if (delta === 0) {
          // Faded source as the backdrop, so a difference can be placed on the page.
          const grey = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3;
          heat.data.set([grey, grey, grey, 48], i);
          continue;
        }
        total++;
        heat.data.set([255, 0, 0, 96 + Math.round((159 * delta) / 255)], i);
        let hit = false;
        for (const s of stats) {
          if (x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height) {
            hit = true;
            s.diff++;
            s.minX = Math.min(s.minX, x), s.minY = Math.min(s.minY, y);
            s.maxX = Math.max(s.maxX, x), s.maxY = Math.max(s.maxY, y);
          }
        }
        if (!hit) {
          outside.diff++;
          outside.minX = Math.min(outside.minX, x), outside.minY = Math.min(outside.minY, y);
          outside.maxX = Math.max(outside.maxX, x), outside.maxY = Math.max(outside.maxY, y);
        }
      }
    }
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").putImageData(heat, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const summarise = (s, area) => ({
      diffPixels: s.diff,
      ratio: area ? s.diff / area : 0,
      bbox: s.diff ? { x: s.minX, y: s.minY, width: s.maxX - s.minX + 1, height: s.maxY - s.minY + 1 } : null,
    });
    return {
      width,
      height,
      total: { diffPixels: total, ratio: total / (width * height) },
      regions: stats.map((s) => ({
        name: s.name,
        rect: { x: s.x, y: s.y, width: s.width, height: s.height },
        ...summarise(s, s.width * s.height),
      })),
      outside: summarise(outside, width * height),
      heatmap: btoa(bin),
    };
  });
}

const args = parseArgs(process.argv.slice(2));
const sourceB64 = readFileSync(args.source).toString("base64");
const cloneB64 = readFileSync(args.clone).toString("base64");
const page = await connect(await launchChrome());
const result = await page.evaluate(
  `(${compareInPage})(${JSON.stringify(sourceB64)}, ${JSON.stringify(cloneB64)}, ${JSON.stringify(args.regions)})`,
);
page.close();
if (result.sizeMismatch) {
  const { source, clone } = result.sizeMismatch;
  fail(`sizes differ: source ${source.join("×")}, clone ${clone.join("×")}; reshoot under the same conditions`);
}
writeFileSync(args.out, Buffer.from(result.heatmap, "base64"));
delete result.heatmap;
console.log(JSON.stringify({ heatmap: args.out, ...result }, null, 2));
process.exit(0);
