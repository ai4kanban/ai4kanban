// Making a board in a folder that has none (#178).
//
// Outside the app this is `npx ai4kanban install`, and the "no board here"
// screen says so. In the app there is no terminal to type it into and no Node to
// run npx with, so the app carries that very command — `resources/cli`, the same
// `cli/` package published to npm — and runs it under Electron's own Node. Same
// script, same result: `docs/kanban/` scaffolded, with setup's own checklist
// waiting inside it, and nothing written outside it. The coding agent skill is
// not part of this (#174) — it is added later, from Configuration → Skill.
//
// Nothing here decides anything the CLI wouldn't: no tracks are passed, so the
// board gets the defaults, and everything past that is setup's job — which is
// what the board shows the moment this returns.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { copy } from "./copy";
import { nodeBinary } from "./node-binary";
import { bundledResource } from "./resources";

// Long enough for a slow disk to copy a few hundred small files, short enough
// that a wedged install eventually says so instead of spinning forever.
const TIMEOUT_MS = 120_000;

/** Scaffold a board in `dir`. Resolves when it is there; rejects with something
 *  worth showing a person when it isn't. */
export function makeBoard(dir: string): Promise<void> {
  const entry = bundledResource("cli", "bin", "ai4kanban.mjs");
  if (!fs.existsSync(entry)) {
    return Promise.reject(new Error(copy().board.installerMissing(entry)));
  }
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
        resolve();
      },
    );
  });
}
