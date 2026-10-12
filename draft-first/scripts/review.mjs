#!/usr/bin/env node
// `node review.mjs .draft-first/<slug>.md` — opens the contract on the project's review
// service, starting the service in the background when none is running, and prints the
// address and anything a draft needs fixed.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Stamped by `draft-first install`; the service comes from this release of the package.
const VERSION = "0.1.0";
const LOCAL_SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "serve.mjs");

const arg = process.argv[2];
if (!arg || !arg.endsWith(".md") || !fs.existsSync(arg)) {
  console.error("Usage: node review.mjs .draft-first/<slug>.md");
  process.exit(1);
}
const file = fs.realpathSync(arg);
const dir = path.dirname(file);
if (path.basename(dir) !== ".draft-first") {
  console.error("The contract must sit in the project's .draft-first/ folder.");
  process.exit(1);
}
const root = path.dirname(dir);
const slug = path.basename(file, ".md");
const record = path.join(dir, ".server.json");

async function running() {
  try {
    const { port } = JSON.parse(fs.readFileSync(record, "utf8"));
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    const body = await res.json();
    return fs.realpathSync(body.root) === root ? port : null;
  } catch {
    return null;
  }
}

function start() {
  fs.rmSync(record, { force: true });
  const log = fs.openSync(path.join(dir, ".server.log"), "a");
  const [cmd, args] = fs.existsSync(LOCAL_SERVER)
    ? [process.execPath, [LOCAL_SERVER, root]]
    : ["npx", ["--yes", `draft-first@${VERSION}`, "serve", root]];
  spawn(cmd, args, { detached: true, stdio: ["ignore", log, log], shell: process.platform === "win32" && cmd === "npx" }).unref();
}

function open(url) {
  if (process.env.DRAFT_FIRST_NO_OPEN) return;
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {
    // No browser to open; the printed address is enough.
  }
}

let port = await running();
if (!port) {
  start();
  // The first start may download the package; give it time.
  for (let waited = 0; !port && waited < 180_000; waited += 500) {
    await new Promise((r) => setTimeout(r, 500));
    port = await running();
  }
  if (!port) {
    console.error(`The review service did not start. See ${path.relative(process.cwd(), path.join(dir, ".server.log"))}.`);
    process.exit(1);
  }
}

const res = await fetch(`http://127.0.0.1:${port}/api/contract/${encodeURIComponent(slug)}`);
const model = await res.json();
const url = `http://127.0.0.1:${port}/?c=${encodeURIComponent(slug)}`;
open(url);
console.log(`Review page: ${url}`);
console.log(`Status: ${model.status}`);
if (model.problems?.length) {
  console.log("\nFix these, then run this command again:");
  for (const p of model.problems) console.log(`- ${p}`);
}
