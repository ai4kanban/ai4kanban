// Which binary the app runs its Node children with.
//
// There is no Node on the machine — that is the point of the app — so children
// run under Electron's own, `ELECTRON_RUN_AS_NODE=1`. The obvious binary to use
// is `process.execPath`, and on macOS that is the wrong one: it is the app
// bundle's main executable, so LaunchServices registers anything started from
// it as a Foreground app and gives it a Dock tile — a nameless black square
// reading "exec" sitting next to the real icon for as long as a board is open.
// Electron's *helper* binary is the same Node inside a bundle marked
// `LSUIElement`, so a child of it checks in as a UIElement and shows nothing.
//
// Windows and Linux have no such registry; there `process.execPath` is right.

import fs from "node:fs";
import path from "node:path";

/** `<Name>.app/Contents/MacOS/<Name>` → `…/Frameworks/<Name> Helper.app/Contents/MacOS/<Name> Helper`. */
function macHelper(execPath: string): string | null {
  const name = path.basename(execPath);
  const contents = path.resolve(path.dirname(execPath), "..");
  const helper = path.join(
    contents,
    "Frameworks",
    `${name} Helper.app`,
    "Contents",
    "MacOS",
    `${name} Helper`,
  );
  return fs.existsSync(helper) ? helper : null;
}

/** Electron's Node, as a path to spawn. Pair it with `ELECTRON_RUN_AS_NODE=1`. */
export function nodeBinary(): string {
  if (process.platform !== "darwin") return process.execPath;
  return macHelper(process.execPath) || process.execPath;
}
