#!/usr/bin/env node
// Capture the loop drawings from /shots/ as flat images for the README and
// social posts. Headless Chrome over CDP — one page load, one clip per
// `data-shot` box — then `sips` downscales and encodes.
//
//   cd web && pnpm dev            # in one shell
//   node scripts/capture-shots.mjs
//
// Writes PNG at 2x and a width-capped JPEG next to it, under web/.shots/.
// Upload the JPEGs to the CDN; nothing here is committed.

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url).pathname;
const PORT = 9333;
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The page lays the mats out at 1160 CSS px; 2x capture then a 1600px cap keeps
// the JPEG under a couple hundred KB while staying sharp at README width.
const VIEWPORT = { width: 1160, height: 900 };
const SCALE = 2;
const JPEG_WIDTH = 1600;
const JPEG_QUALITY = 82;

// PixelWash paints on requestIdleCallback and animates; give it room to settle
// so every mat is captured with its texture on, not just the CSS ground.
const SETTLE_MS = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

/** Wait for Chrome's debugging endpoint, then hand back the page target. */
async function pageTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await fetchJson("/json/list");
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // endpoint not up yet
    }
    await sleep(100);
  }
  throw new Error("Chrome debugging endpoint never came up");
}

/** Minimal CDP client: send returns the result, events resolve waiters. */
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const waiters = [];
  let seq = 0;

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      if (!entry) return;
      if (msg.error) entry.reject(new Error(msg.error.message));
      else entry.resolve(msg.result);
      return;
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].method === msg.method) {
        waiters[i].resolve(msg.params);
        waiters.splice(i, 1);
      }
    }
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    open,
    send(method, params = {}) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method) {
      return new Promise((resolve) => waiters.push({ method, resolve }));
    },
    close: () => ws.close(),
  };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

const profile = join(process.env.TMPDIR ?? "/tmp", "ai4kanban-shot-capture");
await rm(profile, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const target = await pageTarget();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.open;

  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // The dev server's build indicator is a fixed element, so it lands in the
  // clip of whichever box happens to sit under it. And some shots run a loop —
  // a still wants their resting frame, not whichever one the clock is on. Every
  // shot is drawn so that frame is the whole picture; the page's own fade-in is
  // a transition, so this leaves it alone.
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'nextjs-portal{display:none!important}'
        + '[data-shot] *{animation:none!important}';
      document.head.append(s);
    })`,
  });

  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${BASE}/shots/` });
  await loaded;
  await sleep(SETTLE_MS);

  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('[data-shot]')].map(el => {
      const r = el.getBoundingClientRect();
      return { slug: el.dataset.shot, x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    }))`,
    returnByValue: true,
  });
  const boxes = JSON.parse(result.value);
  if (!boxes.length) throw new Error("no [data-shot] boxes on /shots/");

  for (const box of boxes) {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        scale: SCALE,
      },
    });
    const png = join(OUT, `${box.slug}.png`);
    const jpg = join(OUT, `${box.slug}.jpg`);
    await writeFile(png, Buffer.from(data, "base64"));
    await run("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", String(JPEG_QUALITY),
      "--resampleWidth", String(JPEG_WIDTH),
      png, "--out", jpg,
    ]);
    console.log(`${box.slug}  ${box.width}x${box.height} css`);
  }

  cdp.close();
} finally {
  chrome.kill();
}

console.log(`\nwrote ${OUT}`);
