import fs from "node:fs";
import path from "node:path";
import { boardSearchStart, findRepoRoot } from "./paths";

// Is this board running inside the desktop app, or being served to a browser?
//
// The app (../desktop) starts this very server and sets KANBAN_DESKTOP=1 on it.
// Two things turn on that answer, and nothing else does: the app offers its own
// folder picker where the browser can only name a command to type, and the
// browser gets a line saying the app exists. Neither way is the deprecated one —
// it is the same server behind both.
//
// It is read on the server, not sniffed in the browser, so the first paint is
// already right — no bar that flashes up and disappears.

export function isDesktop(): boolean {
  return process.env.KANBAN_DESKTOP === "1";
}

/** Whether this page IS the window's title bar — the app on macOS, where the
 *  window is drawn without one and the board's top row stands in for it
 *  (desktop/src/main.ts). It buys the page a gutter for the traffic lights and
 *  a drag region; everything it turns on lives in app/globals.css under
 *  `.a4k-inset`.
 *
 *  Read on the server like the answer above, so the gutter is in the first
 *  paint rather than shoved in afterwards — the server is the app's own
 *  process's child on the user's own machine, so its platform is the window's.
 *  Not on Windows or Linux: the app keeps the native frame there, since hiding
 *  it would take the window buttons with it. */
export function insetTitleBar(): boolean {
  return isDesktop() && process.platform === "darwin";
}

// --- is anybody looking at this board? --------------------------------------
//
// In the app a project keeps its own server, and a server the user has switched
// away from keeps running so the run inside it can finish (#178). That is only
// true of work someone asked for. Work the board starts on its own — the
// auto-refine pass and the recurring cards, both on the dispatcher's timer —
// must not go on spending money on a project nobody is looking at.
//
// The app says which project is on screen by writing its path into the file it
// names in KANBAN_FOCUS_FILE, and rewrites it on every switch. Read fresh each
// time rather than cached, since the whole point is that it changes under us.
// Outside the app there is no such file and no such question: a board served to
// a browser is the only board its server has, so it always works.

export function autoWorkAllowed(): boolean {
  const file = process.env.KANBAN_FOCUS_FILE;
  if (!file) return true;
  let focused: string;
  try {
    focused = fs.readFileSync(file, "utf8").trim();
  } catch {
    // The app hasn't written it yet, or we can't read it. Saying yes keeps a
    // board working the way it does everywhere else; the app ends every run it
    // started when it quits either way.
    return true;
  }
  if (!focused) return true;
  const at = path.resolve(focused);
  // The app names the folder the user picked, which may sit anywhere inside the
  // repo the board was found in — so either answer counts as "this is me".
  return at === path.resolve(boardSearchStart()) || at === findRepoRoot();
}
