// The review service: one per project, for every contract in its `.draft-first/`.
// `node serve.mjs <project root>` — writes `.draft-first/.server.json`, and exits after
// 30 minutes with no review page open.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { confirmContract, parseContract } from "./contract.mjs";
import { contractModel } from "./model.mjs";
import { IMAGE_EXTS, assetFile } from "./render.mjs";

const IDLE_MS = 30 * 60 * 1000;
const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "page");
const require = createRequire(import.meta.url);
const VENDOR = { "modern-screenshot.js": require.resolve("modern-screenshot/dist/index.js") };
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const SLUG = /^[a-z0-9][a-z0-9._-]*$/i;

const root = fs.realpathSync(process.argv[2] ?? process.cwd());
const dir = path.join(root, ".draft-first");
const record = path.join(dir, ".server.json");
fs.mkdirSync(dir, { recursive: true });
const ignore = path.join(dir, ".gitignore");
if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, ".server.json\n.server.log\n");

const pages = new Set();
let lastSeen = Date.now();

function contracts() {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((f) => {
      const slug = f.slice(0, -3);
      const c = parseContract(fs.readFileSync(path.join(dir, f), "utf8"));
      return { slug, title: c.title || slug, status: c.status, mtime: fs.statSync(path.join(dir, f)).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function contractPath(slug) {
  if (!SLUG.test(slug)) return null;
  const file = path.join(dir, `${slug}.md`);
  return fs.existsSync(file) ? file : null;
}

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });

async function handle(req, res) {
  lastSeen = Date.now();
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (url.pathname === "/health") return send(res, 200, { ok: true, root });
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return send(res, 200, fs.readFileSync(path.join(PAGE, "index.html")), TYPES[".html"]);
  }
  if (parts[0] === "page" && parts.length === 2) {
    const file = VENDOR[parts[1]] ?? path.join(PAGE, parts[1]);
    if (!file.startsWith(PAGE) && !VENDOR[parts[1]]) return send(res, 404, {});
    if (!fs.existsSync(file)) return send(res, 404, {});
    return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] ?? "application/octet-stream");
  }
  if (parts[0] === "files" && parts[1] === ".assets") {
    try {
      const { file, ext } = assetFile(dir, parts.slice(1).join("/"));
      if (!IMAGE_EXTS.includes(ext)) return send(res, 404, {});
      return send(res, 200, fs.readFileSync(file), TYPES[`.${ext}`]);
    } catch {
      return send(res, 404, {});
    }
  }
  if (url.pathname === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write("retry: 2000\n\n");
    pages.add(res);
    req.on("close", () => {
      pages.delete(res);
      lastSeen = Date.now();
    });
    return;
  }
  if (url.pathname === "/api/contracts") return send(res, 200, contracts());
  if (parts[0] === "api" && parts[1] === "contract" && parts[2]) {
    const file = contractPath(parts[2]);
    if (!file) return send(res, 404, { error: "missing" });
    const text = fs.readFileSync(file, "utf8");
    if (req.method === "GET" && parts.length === 3) return send(res, 200, await contractModel(dir, parts[2], text));
    if (req.method === "POST" && parts[3] === "confirm") {
      const body = await readBody(req);
      const current = await contractModel(dir, parts[2], text);
      if (body.version !== current.version) return send(res, 409, { error: "changed" });
      if (current.status === "confirmed") return send(res, 409, { error: "confirmed" });
      fs.writeFileSync(file, confirmContract(text, body));
      return send(res, 200, { ok: true });
    }
  }
  send(res, 404, {});
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => send(res, 500, { error: e instanceof Error ? e.message : String(e) }));
});

function cleanUp() {
  try {
    if (JSON.parse(fs.readFileSync(record, "utf8")).pid === process.pid) fs.rmSync(record);
  } catch {
    // Already gone, or another service's.
  }
}

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  fs.writeFileSync(record, JSON.stringify({ port, pid: process.pid }) + "\n");
  console.log(`draft-first review: http://127.0.0.1:${port}/`);
});

// Pages reload what changed on disk — an agent redrawing a draft shows up without a refresh.
let pending = null;
fs.watch(dir, { recursive: true }, (_, name) => {
  if (!name || name.startsWith(".server")) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const res of pages) res.write(`data: changed\n\n`);
  }, 200);
});

setInterval(() => {
  for (const res of pages) res.write(": ping\n\n");
  if (!pages.size && Date.now() - lastSeen > IDLE_MS) {
    cleanUp();
    process.exit(0);
  }
}, 30_000).unref?.();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanUp();
    process.exit(0);
  });
}
