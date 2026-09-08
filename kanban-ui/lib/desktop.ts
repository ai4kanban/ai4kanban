import fs from "node:fs";
import path from "node:path";
import { boardSearchStart, findRepoRoot, kanbanDir } from "./paths";

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
// recurring cards on the dispatcher's timer — must not go on spending money on a
// project nobody is looking at.
//
// The app says which boards are on screen by writing their paths into the file
// it names in KANBAN_FOCUS_FILE, one per line — one window, one line (#495) —
// and rewrites it on every switch. The first line is also the board that raises
// the account's system notifications (`alertsAllowed` below). Read fresh each
// time rather than cached, since the whole point is that it changes under us.
// Outside the app there is no such file and no such question: a board served to
// a browser is the only board its server has, so it always works.

/** The boards the app says are on screen, oldest window first. Empty outside the app, and
 *  empty when the file hasn't been written or can't be read — saying nothing is on screen
 *  is what keeps a board working the way it does everywhere else, and the app ends every
 *  run it started when it quits either way. */
function boardsOnScreen(): string[] {
  const file = process.env.KANBAN_FOCUS_FILE;
  if (!file) return [];
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function autoWorkAllowed(): boolean {
  const open = boardsOnScreen();
  return open.length === 0 || open.some(onScreen);
}

/** Whether this board server is the one that raises the account's system notifications.
 *
 *  The alerts a board server hands out are the whole ACCOUNT's, not its own board's — that
 *  is how a board you are not looking at reaches you at all. So exactly one server may
 *  raise them, however many are on screen (#495): the first line of the focus file, which
 *  is the oldest open window's board and moves only when that window goes. Every other
 *  on-screen board still subscribes, because its own bell is what it fills. */
export function alertsAllowed(): boolean {
  const open = boardsOnScreen();
  return open.length === 0 || onScreen(open[0]);
}

/** Whether one line of the focus file names this board. */
function onScreen(named: string): boolean {
  const at = path.resolve(named);
  // The app names the folder the user picked, which may sit anywhere inside the
  // repo the board was found in — so either answer counts as "this is me".
  if (at === path.resolve(boardSearchStart())) return true;
  // …except that a project may hold a second board (#407), and then its path is
  // no longer proof of anything: the app writes the project when `docs/kanban`
  // is on screen, and `marketing/kanban` would read that as its own turn. Only
  // the project's own board may answer to the project's name.
  const root = findRepoRoot();
  return root !== null && at === root && kanbanDir() === path.join(root, "docs", "kanban");
}
