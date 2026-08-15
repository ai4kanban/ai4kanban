// The bridge between the board's pages and the app.
//
// Nothing here reads the disk or runs a command; each call is a message to the
// main process, which decides what to do with it. What the surface IS — the
// calls, their arguments, their answers — is written down in shared/bridge.ts,
// and typing the object against it here is what keeps this end and main.ts's
// end from drifting apart.
//
// It types against that file but must not REQUIRE it: this script runs in a
// sandboxed renderer (Electron's default since 20), where `require` is a
// polyfill that knows `electron` and a few builtins and nothing else. A
// relative require throws before `exposeInMainWorld` is ever reached, and the
// page then sees no `window.ai4kanban` at all — a whole app's worth of missing
// buttons, announced nowhere. So the imports below are type-only, erased at
// compile time, and the channel names are written out here as values.
//
// Writing them out is not a second copy that can drift: `Channels` below is the
// type of the real object, whose names are literal strings, so a name typed
// wrong here fails the typecheck rather than the app.

import { contextBridge, ipcRenderer } from "electron";
import type { Ai4kanbanBridge, CHANNELS as Channels, NavDirection } from "./shared/bridge";

const CHANNELS: typeof Channels = {
  info: "a4k:info",
  projects: "a4k:projects",
  openProject: "a4k:open-project",
  forgetProject: "a4k:forget-project",
  pickRepo: "a4k:pick-repo",
  createBoard: "a4k:create-board",
  update: "a4k:update",
  skipUpdate: "a4k:skip-update",
  openExternal: "a4k:open-external",
  fullscreen: "a4k:fullscreen",
  navigated: "a4k:navigated",
};

const bridge: Ai4kanbanBridge = {
  info: () => ipcRenderer.invoke(CHANNELS.info),
  projects: () => ipcRenderer.invoke(CHANNELS.projects),
  openProject: (dir) => ipcRenderer.invoke(CHANNELS.openProject, dir),
  forgetProject: (dir) => ipcRenderer.invoke(CHANNELS.forgetProject, dir),
  pickRepo: () => ipcRenderer.invoke(CHANNELS.pickRepo),
  createBoard: () => ipcRenderer.invoke(CHANNELS.createBoard),
  update: () => ipcRenderer.invoke(CHANNELS.update),
  skipUpdate: (version) => ipcRenderer.invoke(CHANNELS.skipUpdate, version),
  openExternal: (url) => ipcRenderer.invoke(CHANNELS.openExternal, url),
  onNavigated: (fn) => {
    navWatchers.add(fn);
    return () => navWatchers.delete(fn);
  },
};

// Whoever is drawing the mark on the edge. Two things feed it: a swipe, read
// below, and a move made from the menu, which main tells us about.
const navWatchers = new Set<(direction: NavDirection) => void>();
const moved = (direction: NavDirection) => navWatchers.forEach((fn) => fn(direction));
ipcRenderer.on(CHANNELS.navigated, (_e, direction: NavDirection) => moved(direction));

contextBridge.exposeInMainWorld("ai4kanban", bridge);

// Full screen, said as a class rather than as a call: the page's title-bar
// gutter is CSS, and CSS is where the answer is wanted. The isolated world this
// runs in shares the page's DOM, so the class lands on the real <html>.
//
// It is kept and re-applied rather than written once: main sends the state on
// every load, but a message can arrive before the document has an element to
// put it on.
let fullscreen = false;
const paint = () => document.documentElement?.classList.toggle("a4k-fullscreen", fullscreen);
ipcRenderer.on(CHANNELS.fullscreen, (_e, on: boolean) => {
  fullscreen = !!on;
  paint();
});
window.addEventListener("DOMContentLoaded", paint);

// The two-finger swipe back and forward (#210).
//
// A browser answers this gesture itself, deep in Chromium, and Electron leaves
// that machinery off — no switch turns it on. What does reach the page is what
// the gesture is made of: sideways scrolling. So the swipe is read here, from
// the wheel events, and the move itself is left to main, which already knows
// what back and forward mean for the menu.
//
// This has to live in this file rather than beside the rest of the app's code:
// the renderer is sandboxed, so a relative require throws (see the top of this
// file), and there is nowhere else in the page the app can put code.
//
// One gesture, two jobs, and only one of them can have it. The board's columns
// are scrolled sideways with the very same two fingers, and they can usually go
// both ways at once, so a board that answered the swipe would either stop
// scrolling or navigate when the user meant to scroll. The columns keep it: the
// swipe is a card page's, where nothing scrolls sideways and back is what the
// gesture almost always means. From the board, Back and Forward are the menu's.
//
// A card page can still hold something that scrolls sideways on its own — a
// wide code block — and scrolling one of those must never count as a swipe.
//
// The move itself is made here, on the page's own history, and NOT by asking
// main to drive the window's. Those are two different accounts of where the
// user has been, and they disagree: the board is one page that rewrites its
// address as you open cards, and the router rewrites the history entries along
// with it, so a moment after going back the window believes there is nothing
// ahead and forward stops working. The page's history is the one the board
// keeps, so it is the one to move.

/** Sideways travel, in pixels, before a scroll counts as a swipe. Around a third
 *  of a comfortable flick: far enough that a nudge never navigates, short enough
 *  that the gesture doesn't feel like work. */
const SWIPE_TRAVEL = 90;
/** A gap this long with no wheel event ends the gesture. It also outlasts the
 *  coasting macOS keeps sending after the fingers lift, so one flick moves one
 *  view and its momentum doesn't move a second. */
const SWIPE_IDLE_MS = 250;

/** Is this one of the pages the swipe belongs to? A card is `/<id>`, a memory
 *  file is `/memory/<name>` or `/memory/<module>/<name>` (#129, #130), and the
 *  board is `/` — see the note above for why the board is left out. The board's
 *  columns are what the gesture was kept from; nothing on a memory page scrolls
 *  sideways, so back is what it means there, exactly as on a card. */
function swipeablePage(): boolean {
  return /^\/\d+$/.test(location.pathname) || /^\/memory\/[^/]+(\/[^/]+)?$/.test(location.pathname);
}

/** Is anything from `target` up to the root still able to scroll `delta`'s way?
 *  Then the user is scrolling that thing, not swiping the window. */
function absorbsScroll(target: EventTarget | null, delta: number): boolean {
  let node = target instanceof Element ? target : null;
  while (node) {
    const overflow = getComputedStyle(node).overflowX;
    if (overflow === "auto" || overflow === "scroll") {
      // Rounding leaves a pixel of slack at either end on a scaled display, so
      // "at the end" is a pixel wide rather than exact.
      const room =
        delta < 0 ? node.scrollLeft : node.scrollWidth - node.clientWidth - node.scrollLeft;
      if (room > 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Move the page one view, and mark the edge only if it really moved. At either
 *  end the browser does nothing and says nothing, so no `popstate` arrives and
 *  no mark is drawn — a swipe with nowhere to go stays silent, as it should. */
function go(direction: NavDirection): void {
  const done = () => {
    window.removeEventListener("popstate", done);
    clearTimeout(giveUp);
    moved(direction);
  };
  // A same-document move answers within a frame or two; this is only here so a
  // move that never lands doesn't leave a listener behind for the next one.
  const giveUp = setTimeout(() => window.removeEventListener("popstate", done), 400);
  window.addEventListener("popstate", done, { once: true });
  if (direction === "back") history.back();
  else history.forward();
}

let travel = 0;
let lastWheel = 0;
let spent = false;

window.addEventListener(
  "wheel",
  (e) => {
    if (e.timeStamp - lastWheel > SWIPE_IDLE_MS) {
      travel = 0;
      spent = false;
    }
    lastWheel = e.timeStamp;
    // The gesture is over: it either moved a view — one flick, one view — or it
    // turned out to be someone scrolling a column. Either way the rest of the
    // flick and its coasting are ignored until the hand goes still.
    if (spent) return;
    if (!swipeablePage()) return;
    // A mouse wheel reports whole lines and has no sideways axis to speak of; a
    // trackpad reports pixels. Only the trackpad is a swipe.
    if (e.deltaMode !== 0) return;
    // Mostly up and down is scrolling, whatever sideways drift came with it.
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    // Someone is scrolling a column, so this whole flick belongs to it —
    // including the part after the column runs out. Carrying on to the end of a
    // column is not a way of asking to leave the page.
    if (absorbsScroll(e.target, e.deltaX)) {
      travel = 0;
      spent = true;
      return;
    }
    // Turning the fingers round starts the count again, so a swipe one way
    // can't be finished off by drift the other.
    if (travel !== 0 && travel < 0 !== e.deltaX < 0) travel = 0;
    travel += e.deltaX;
    if (Math.abs(travel) < SWIPE_TRAVEL) return;
    // Scrolling towards the left edge is the swipe a browser reads as going
    // back, and it inverts with the trackpad's own direction setting exactly as
    // a browser's does, because it is that setting doing the inverting.
    const direction: NavDirection = travel < 0 ? "back" : "forward";
    travel = 0;
    spent = true;
    go(direction);
  },
  // Capture, so a page that handles its own wheel events can't swallow the
  // gesture; passive, because this only watches — the scrolling it lets through
  // is scrolling the user asked for.
  { capture: true, passive: true },
);
