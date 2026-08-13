// The board's own server, running inside the app — one per project.
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
//
// Why a POOL of them rather than one restarted on every switch (#178): the
// server is built around one board — its runs, its locks and every file path it
// knows are that board's — so a second project means a second server, not a
// second board inside the first. Giving each project its own also keeps the
// promise that switching away doesn't end a run: the run belongs to its
// project's server, which keeps running behind the window. A project the user
// left with nothing going has its server stopped straight away, so the app
// doesn't carry a Node process per folder anyone ever opened.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { hasLiveRun } from "./projects";
import { bundledResource } from "./resources";
import type { Env } from "./shell-env";

const HOST = "127.0.0.1";
// How long we wait for the server to answer before calling it dead. It is a
// prebuilt server with nothing to compile, so this is generous.
const READY_TIMEOUT_MS = 60_000;
// How long a run gets to end on its own after we ask, before it is killed.
const STOP_GRACE_MS = 3000;

const urlFor = (port: number) => `http://${HOST}:${port}/`;

/** A loopback port nobody is listening on. Asking the OS for one beats a fixed
 *  port: two windows, or a board someone already started in a terminal, must
 *  not fight over 7420. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      // A TCP server that has just bound a port always answers with the object
      // form; the string form is for a Unix socket, which this never is.
      if (!address || typeof address === "string") {
        return probe.close(() => reject(new Error("the OS gave out no loopback port")));
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

/** Resolves once the server answers on `url`, rejects when it never does or the
 *  child dies first. */
function waitUntilAnswering(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let dead: string | null = null;
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

export interface BoardServerOptions {
  /** The user's own shell environment (see lib/shell-env.ts), so a run finds
   *  the coding agent even though nothing here came from a terminal. */
  env: Env;
  version: string;
  boardDir: string;
  /** Where the app writes which project is on screen. The server reads it to
   *  decide whether to do work nobody asked for — see the pool below. */
  focusFile: string;
}

/**
 * One running board server, on one project. Started once and left alone —
 * switching project starts another one rather than repointing this.
 */
export class BoardServer {
  readonly env: Env;
  readonly version: string;
  readonly boardDir: string;
  readonly focusFile: string;
  private port: number | null = null;
  private child: ChildProcess | null = null;

  constructor({ env, version, boardDir, focusFile }: BoardServerOptions) {
    this.env = env;
    this.version = version;
    this.boardDir = boardDir;
    this.focusFile = focusFile;
  }

  get url(): string | null {
    return this.port ? urlFor(this.port) : null;
  }

  get alive(): boolean {
    const c = this.child;
    return Boolean(c && c.exitCode === null && c.signalCode === null);
  }

  /** Whether an agent run is going in this project right now. */
  get busy(): boolean {
    return hasLiveRun(this.boardDir);
  }

  /** Start the server. Resolves once it answers. */
  async start(): Promise<void> {
    const boardDir = this.boardDir;
    const port = this.port ?? (await freePort());
    this.port = port;
    const entry = bundledResource("server", "server.js");
    if (!fs.existsSync(entry)) {
      throw new Error(
        `the board server is missing from this build (looked in ${entry}).\n` +
          "Built from source? Run `npm run bundle` in desktop/ first.",
      );
    }
    const child = spawn(process.execPath, [entry], {
      // The server finds its own bundled assets through __dirname; the board is
      // found through KANBAN_BOARD_DIR, never through cwd.
      cwd: path.dirname(entry),
      env: {
        ...this.env,
        // Electron's binary, asked to behave as plain Node.
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: HOST,
        KANBAN_BOARD_DIR: boardDir,
        // What tells the board it is inside the app: it drops the "open it in a
        // browser" deprecation notice, and offers the app's own folder picker
        // where it would otherwise name a command to type.
        KANBAN_DESKTOP: "1",
        KANBAN_DESKTOP_VERSION: this.version,
        // Which project the window is showing, read fresh whenever the board
        // considers starting work nobody asked for (#178). A server left
        // running behind the window keeps its own runs going, but must not
        // spend money refining a board nobody is looking at.
        KANBAN_FOCUS_FILE: this.focusFile,
        // The board's rules — which agent runs, the words each run sends it, the record of
        // what is running (#168). The app carries its own copy, so a machine with nothing
        // installed can still put an agent to work; without this the board would look for
        // one in the project's skill folder and a fresh repo has none.
        AI4KANBAN_CLI: bundledResource("cli", "skill", "kanban.mjs"),
      },
      // Its own process group, so ending it ends the coding-agent runs it
      // started too. Closing the window must not leave an agent writing to the
      // repo behind the user's back.
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child = child;
    // The server's output is the app's log, not the user's — it goes to the
    // terminal when there is one and nowhere when there isn't.
    child.stdout?.on("data", (d) => process.stdout.write(`[board] ${d}`));
    child.stderr?.on("data", (d) => process.stderr.write(`[board] ${d}`));
    await waitUntilAnswering(urlFor(port), child);
  }

  /** End the server and everything it started. Safe to call when nothing is
   *  running, and safe to call twice. */
  async stop(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      return;
    }
    this.child = null;
    const ended = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    kill(child, "SIGTERM");
    const killed = await Promise.race([
      ended.then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), STOP_GRACE_MS)),
    ]);
    if (!killed) {
      kill(child, "SIGKILL");
      await Promise.race([ended, new Promise<void>((r) => setTimeout(r, 1000))]);
    }
  }
}

// Kill the server AND the agent runs under it. On macOS and Linux the child
// leads its own process group (`detached` above), so a negative pid reaches all
// of them. On Windows there are no process groups; `taskkill /T` walks the tree
// instead.
function kill(child: ChildProcess, signal: NodeJS.Signals): void {
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

// How often the pool looks at the servers it is keeping alive only for their
// runs, to see whether those runs have ended.
const SWEEP_MS = 30_000;

export interface BoardServersOptions {
  env: Env;
  version: string;
  focusFile: string;
}

/**
 * Every board server the app has running: the one behind the window, plus any
 * kept alive because a run is still going in it.
 *
 * The rule is one line long — a server stays for as long as its project is open
 * or has a run going, and goes the moment neither is true. That is what makes a
 * run survive the user switching away and a project they merely glanced at cost
 * nothing.
 */
export class BoardServers {
  readonly env: Env;
  readonly version: string;
  /** The file the app writes the open project's path into, so each server can
   *  tell whether it is the one on screen. */
  readonly focusFile: string;
  /** boardDir → BoardServer */
  private readonly servers = new Map<string, BoardServer>();
  private current: BoardServer | null = null;
  private sweeper: NodeJS.Timeout | null = null;

  constructor({ env, version, focusFile }: BoardServersOptions) {
    this.env = env;
    this.version = version;
    this.focusFile = focusFile;
  }

  /** The project the window is showing, or null before the first one opens. */
  get boardDir(): string | null {
    return this.current?.boardDir ?? null;
  }

  get url(): string | null {
    return this.current?.url ?? null;
  }

  /** Make `boardDir` the open project and return the URL to show. Reuses the
   *  server already running on it — coming back to a project you left mid-run
   *  puts you back in front of that very run, log and all. */
  async open(boardDir: string): Promise<string> {
    let server = this.servers.get(boardDir);
    if (server && !server.alive) {
      this.servers.delete(boardDir);
      server = undefined;
    }
    if (!server) {
      server = new BoardServer({
        env: this.env,
        version: this.version,
        boardDir,
        focusFile: this.focusFile,
      });
      this.servers.set(boardDir, server);
      try {
        await server.start();
      } catch (e) {
        this.servers.delete(boardDir);
        throw e;
      }
    }
    const previous = this.current;
    this.current = server;
    // Say which project is on screen BEFORE the old one is let go, so no server
    // ever reads the file mid-switch and thinks it is still the focused one.
    this.writeFocus();
    if (previous && previous !== server) await this.retire(previous);
    this.sweep();
    const url = server.url;
    // A server that started has a port, and so a URL. Saying so out loud beats
    // handing the window an undefined to load.
    if (!url) throw new Error("the board server came up without a port");
    return url;
  }

  /** Let go of a server the window has just left: stopped now when nothing is
   *  going in it, kept (and swept later) when a run is. */
  async retire(server: BoardServer): Promise<void> {
    if (server.busy) return;
    this.servers.delete(server.boardDir);
    await server.stop();
  }

  /** Stop the background servers whose runs have finished. Runs on a timer for
   *  as long as there is anything to watch, and stops itself when there isn't. */
  sweep(): void {
    const background = [...this.servers.values()].filter((s) => s !== this.current);
    for (const server of background) {
      if (server.busy && server.alive) continue;
      this.servers.delete(server.boardDir);
      void server.stop();
    }
    const watching = [...this.servers.values()].some((s) => s !== this.current);
    if (watching && !this.sweeper) {
      this.sweeper = setInterval(() => this.sweep(), SWEEP_MS);
      this.sweeper.unref();
    } else if (!watching && this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }

  /** Which projects have a server up right now, and which of them is on screen —
   *  what the projects list needs beyond what it can read off the disk. */
  running(): string[] {
    return [...this.servers.keys()];
  }

  writeFocus(): void {
    try {
      fs.mkdirSync(path.dirname(this.focusFile), { recursive: true });
      fs.writeFileSync(this.focusFile, `${this.boardDir ?? ""}\n`);
    } catch {
      // A focus file we can't write means a backgrounded board may keep
      // refining itself. Not worth an error in the user's face, and quitting
      // still ends every run.
    }
  }

  /** End every server, and every run under all of them. What quitting does. */
  async stopAll(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    const all = [...this.servers.values()];
    this.servers.clear();
    this.current = null;
    await Promise.all(all.map((s) => s.stop()));
  }
}
