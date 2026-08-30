// Making a board in a folder that has none (#178).
//
// Outside the app this is `npx ai4kanban install`, and the "no board here"
// screen says so. In the app there is no terminal to type it into and no Node to
// run npx with, so the app carries that very command — `resources/cli`, the same
// `cli/` package published to npm — and runs it under Electron's own Node. Same
// script, same result: `docs/kanban/` scaffolded, with setup's own checklist
// waiting inside it, and nothing written outside it. The coding agent skill is
// not part of this (#174) — it is added later, from Configuration → General.
//
// Nothing here decides anything the CLI wouldn't: no tracks are passed, so the
// board gets the defaults, and everything past that is setup's job — which is
// what the board shows the moment this returns.
//
// This now runs when a boardless folder is OPENED, not when a screen's
// button is pressed, so it also records what it wrote over: opening the wrong
// folder is one press to take back, and `unmakeBoard` is that press.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { copy } from "./copy";
import { nodeBinary } from "./node-binary";
import { bundledResource } from "./resources";

// Long enough for a slow disk to copy a few hundred small files, short enough
// that a wedged install eventually says so instead of spinning forever.
const TIMEOUT_MS = 120_000;

/** What a board that was just made replaced, so opening the wrong folder can be taken
 *  back. Two things are touched outside `docs/kanban/` — `docs/` itself, when the
 *  project had none, and the repository's `.gitignore`, which the installer appends the
 *  delivery line to — so both are read before the install and put back by `unmakeBoard`. */
export interface NewBoard {
  dir: string;
  /** There was a `docs/kanban/` here already — a half-finished board the install repaired
   *  rather than wrote. Nothing in it is ours, so it cannot be taken back. */
  boardExisted: boolean;
  /** The project already had a `docs/`, so only `docs/kanban/` is ours to remove. */
  docsExisted: boolean;
  /** The root `.gitignore` as it was, or null when there wasn't one. */
  rootIgnore: string | null;
}

const docsDir = (dir: string) => path.join(dir, "docs");
const boardDir = (dir: string) => path.join(dir, "docs", "kanban");
const rootIgnorePath = (dir: string) => path.join(dir, ".gitignore");

function read(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/** Scaffold a board in `dir`. Resolves with what it wrote over; rejects with something
 *  worth showing a person when the board isn't there afterwards. */
export function makeBoard(dir: string): Promise<NewBoard> {
  const entry = bundledResource("cli", "bin", "ai4kanban.mjs");
  if (!fs.existsSync(entry)) {
    return Promise.reject(new Error(copy().board.installerMissing(entry)));
  }
  const before: NewBoard = {
    dir,
    boardExisted: fs.existsSync(boardDir(dir)),
    docsExisted: fs.existsSync(docsDir(dir)),
    rootIgnore: read(rootIgnorePath(dir)),
  };
  return new Promise((resolve, reject) => {
    execFile(
      nodeBinary(),
      [entry, "install", "--dir", dir],
      {
        cwd: dir,
        timeout: TIMEOUT_MS,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).trim()));
        if (!fs.existsSync(path.join(dir, "docs", "kanban", "todo"))) {
          return reject(new Error(String(stdout).trim() || copy().board.nothingMade));
        }
        resolve(before);
      },
    );
  });
}

/** Take back a board `makeBoard` just made: the folder it wrote, and the two paths outside
 *  it, put back exactly as they were. Only ever called on a board nobody has answered a
 *  setup question on — everything removed here was written by us, minutes ago, into a
 *  folder the user turned out not to mean.
 *
 *  False when there is nothing to take back, which is a board that was already there. */
export function unmakeBoard(made: NewBoard): boolean {
  if (made.boardExisted) return false;
  fs.rmSync(made.docsExisted ? boardDir(made.dir) : docsDir(made.dir), {
    recursive: true,
    force: true,
  });
  const ignore = rootIgnorePath(made.dir);
  if (made.rootIgnore === null) fs.rmSync(ignore, { force: true });
  else if (read(ignore) !== made.rootIgnore) fs.writeFileSync(ignore, made.rootIgnore);
  return true;
}
