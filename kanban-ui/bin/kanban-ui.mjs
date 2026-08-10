#!/usr/bin/env node
// Launch the prebuilt board UI straight from the npm cache.
//
//   npx ai4kanban-ui               # run from your repo root
//   npx ai4kanban-ui --board .     # or point it at the repo
//   npx ai4kanban-ui --port 4000
//
// DEPRECATED (#175). The desktop app is how AI4Kanban is handed out now — it
// carries this same server and needs no Node, no npx and no terminal. This
// package still works and is not going away, but it is frozen at its last
// version and nothing new lands here. Every run says so, once, below.
//
// The package ships a self-contained Next server (.next/standalone/server.js,
// output: 'standalone'), so there's nothing to compile here. The server reads
// the board through lib/paths.ts, which walks up to the first docs/kanban/todo/
// starting at KANBAN_BOARD_DIR. Since this process runs from the npm cache, we
// set KANBAN_BOARD_DIR to the user's directory so the walk-up finds their repo.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const pkgDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = path.join(pkgDir, ".next", "standalone", "server.js");

function help() {
  process.stdout.write(
    [
      "ai4kanban-ui — run the local kanban board UI",
      "",
      "Usage: npx ai4kanban-ui [options]",
      "",
      "Options:",
      "  -b, --board <dir>   repo that holds docs/kanban/ (default: current dir)",
      "  -p, --port <n>      port to serve on (default: 7420)",
      "  -h, --help          show this help",
      "",
      "It serves on localhost only and drives the board in docs/kanban/.",
      "",
      "Deprecated — get the desktop app instead: " + DOWNLOAD_URL,
      "",
    ].join("\n"),
  );
}

// Said once at the top of every run, before the board's own lines, so nobody
// finds out from a changelog. It is a notice, not a refusal: the board comes up
// exactly as it always did.
const DOWNLOAD_URL = "https://ai4kanban.dev/download";

function deprecationNotice() {
  process.stderr.write(
    "\n" +
      "  ai4kanban-ui is deprecated.\n" +
      "  The desktop app is how AI4Kanban is handed out now — nothing to install\n" +
      "  first, and no terminal to keep alive. Get it at:\n" +
      `    ${DOWNLOAD_URL}\n` +
      "  This package keeps working and is frozen at this version; no new release\n" +
      "  lands here.\n\n",
  );
}

deprecationNotice();

const argv = process.argv.slice(2);
let board = process.env.KANBAN_BOARD_DIR || "";
let port = process.env.PORT || "7420";
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-b" || a === "--board") board = argv[++i] || "";
  else if (a === "-p" || a === "--port") port = argv[++i] || port;
  else if (a === "-h" || a === "--help") {
    help();
    process.exit(0);
  } else {
    process.stderr.write(`ai4kanban-ui: unknown option "${a}"\n\n`);
    help();
    process.exit(1);
  }
}
board = path.resolve(board || process.cwd());

if (!fs.existsSync(server)) {
  process.stderr.write(
    `ai4kanban-ui: prebuilt server not found at ${server}\n` +
      "The package should ship it; try reinstalling (npm cache clean --force).\n",
  );
  process.exit(1);
}
if (!fs.existsSync(path.join(board, "docs", "kanban", "todo"))) {
  process.stderr.write(
    `ai4kanban-ui: no docs/kanban/todo/ found at or above ${board}\n` +
      "  This repo has no board yet — make one with: npx ai4kanban install\n" +
      "  Or this is not the repo you meant — start it from your repo root, or pass --board <dir>.\n",
  );
  // Keep going, and say the same two things on the page — the browser is where
  // the user is looking (components/NoBoard.tsx).
}

process.stdout.write(
  `ai4kanban-ui: board ${board}\n` +
    `ai4kanban-ui: http://localhost:${port}\n`,
);

const child = spawn(process.execPath, [server], {
  // Run from the standalone dir so the server finds its bundled assets via
  // __dirname; the board is located through KANBAN_BOARD_DIR, not cwd.
  cwd: path.join(pkgDir, ".next", "standalone"),
  stdio: "inherit",
  env: {
    ...process.env,
    KANBAN_BOARD_DIR: board,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
