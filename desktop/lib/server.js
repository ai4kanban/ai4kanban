"use strict";

// The board's own server, running inside the app.
//
// The board UI is a small Node server behind a web page (../kanban-ui). The app
// does not reimplement any of it — it ships the same prebuilt server, starts it
// on a loopback port nobody else is using, and points a window at it. So every
// button, every run and every log in the app is the board UI itself, and a fix
// there is a fix here.
//
// It runs as a child rather than inside the main process for two reasons: the
// Next server owns `process.env`, `process.cwd()` and the process's exit, none
// of which the app can lend it; and a child can be killed outright, which is
// what closing the window has to do.
//
// There is no Node on the machine to run it with — that is the whole point of
// the app — so it runs under Electron's own Node, which every build carries:
// `process.execPath` with `ELECTRON_RUN_AS_NODE=1` IS a Node binary.

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const HOST = "127.0.0.1";
// How long we wait for the server to answer before calling it dead. It is a
// prebuilt server with nothing to compile, so this is generous.
const READY_TIMEOUT_MS = 60_000;
// How long a run gets to end on its own after we ask, before it is killed.
const STOP_GRACE_MS = 3000;

/** Where the prebuilt board server lives — inside the packaged app, or in the
 *  sibling checkout when this is run from source. */
function serverEntry() {
  const packaged = path.join(process.resourcesPath || "", "server", "server.js");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "resources", "server", "server.js");
}

/** A loopback port nobody is listening on. Asking the OS for one beats a fixed
 *  port: two windows, or a board someone already started in a terminal, must
 *  not fight over 7420. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Resolves once the server answers on `url`, rejects when it never does or the
 *  child dies first. */
function waitUntilAnswering(url, child) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let dead = null;
  child.once("exit", (code) => {
    dead = `the board server stopped before it was ready (exit ${code ?? "signal"})`;
  });
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (dead) return reject(new Error(dead));
      if (Date.now() > deadline) return reject(new Error("the board server did not answer in time"));
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => setTimeout(attempt, 200));
    };
    attempt();
  });
}

/**
 * One running board server. `start` is called again whenever the user switches
 * repo — the port stays, the child is replaced.
 */
class BoardServer {
  constructor({ env, version }) {
    /** The user's own shell environment (see lib/shell-env.js), so a run finds
     *  the coding agent even though nothing here came from a terminal. */
    this.env = env;
    this.version = version;
    this.port = null;
    this.child = null;
    this.boardDir = null;
  }

  get url() {
    return this.port ? `http://${HOST}:${this.port}/` : null;
  }

  /** Start (or restart) the server on `boardDir`. Resolves once it answers. */
  async start(boardDir) {
    await this.stop();
    if (!this.port) this.port = await freePort();
    const entry = serverEntry();
    if (!fs.existsSync(entry)) {
      throw new Error(
        `the board server is missing from this build (looked in ${entry}).\n` +
          "Built from source? Run `npm run bundle` in desktop/ first.",
      );
    }
    this.boardDir = boardDir;
    this.child = spawn(process.execPath, [entry], {
      // The server finds its own bundled assets through __dirname; the board is
      // found through KANBAN_BOARD_DIR, never through cwd.
      cwd: path.dirname(entry),
      env: {
        ...this.env,
        // Electron's binary, asked to behave as plain Node.
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(this.port),
        HOSTNAME: HOST,
        KANBAN_BOARD_DIR: boardDir,
        // What tells the board it is inside the app: it drops the "open it in a
        // browser" deprecation notice, and offers the app's own folder picker
        // where it would otherwise name a command to type.
        KANBAN_DESKTOP: "1",
        KANBAN_DESKTOP_VERSION: this.version,
      },
      // Its own process group, so ending it ends the coding-agent runs it
      // started too. Closing the window must not leave an agent writing to the
      // repo behind the user's back.
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    // The server's output is the app's log, not the user's — it goes to the
    // terminal when there is one and nowhere when there isn't.
    this.child.stdout.on("data", (d) => process.stdout.write(`[board] ${d}`));
    this.child.stderr.on("data", (d) => process.stderr.write(`[board] ${d}`));
    await waitUntilAnswering(this.url, this.child);
  }

  /** End the server and everything it started. Safe to call when nothing is
   *  running, and safe to call twice. */
  async stop() {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      return;
    }
    this.child = null;
    const ended = new Promise((resolve) => child.once("exit", resolve));
    kill(child, "SIGTERM");
    const killed = await Promise.race([
      ended.then(() => true),
      new Promise((r) => setTimeout(() => r(false), STOP_GRACE_MS)),
    ]);
    if (!killed) {
      kill(child, "SIGKILL");
      await Promise.race([ended, new Promise((r) => setTimeout(r, 1000))]);
    }
  }
}

// Kill the server AND the agent runs under it. On macOS and Linux the child
// leads its own process group (`detached` above), so a negative pid reaches all
// of them. On Windows there are no process groups; `taskkill /T` walks the tree
// instead.
function kill(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    // Already gone, or gone between the check and the signal. Either way there
    // is nothing left to end.
  }
}

module.exports = { BoardServer };
