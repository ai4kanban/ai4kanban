// Going back and forward in the window (#210).
//
// In a browser, a two-finger swipe left or right takes you to the page before
// or after. The app is the same board, so it should do the same. The board and
// each card are real pages here — the board UI routes to `/<id>` — so the
// window's own history is already the list of views the user went through, and
// all this does is drive it.
//
// This file holds the moves themselves and everything that asks for one except
// the swipe. The two-finger swipe — the one a Mac makes out of the box, the one
// a browser answers — never reaches this side at all: Electron leaves
// Chromium's own gesture off and offers no switch to turn it on, so preload.ts
// reads it off the page's wheel events and sends the answer here. Electron's
// `swipe` event below is a different, older gesture — three fingers, and only
// once the user has gone into System Settings → Trackpad → More Gestures and
// changed "Swipe between pages". It is wired up so a Mac set up that way is not
// left out. Windows and Linux have no gesture of either kind; there the menu,
// its shortcuts, and a mouse's own back and forward buttons are the way
// through.
//
// A dialog or a panel over the board is not a page, so a swipe back does not
// close one — it leaves the view the dialog is over and takes the one before.

import type { BrowserWindow } from "electron";
import { CHANNELS, type NavDirection } from "../shared/bridge";

export interface Navigation {
  /** There is a view before this one to go back to. */
  canGoBack(): boolean;
  /** There is a view ahead to go forward to. */
  canGoForward(): boolean;
  /** Go to the view before. Does nothing at the start of the history. */
  back(): void;
  /** Go to the view ahead. Does nothing when there is nothing ahead. */
  forward(): void;
  /** Forget every view before this one — after opening another project, whose
   *  pages are not somewhere the one before is a way back to. */
  reset(): void;
}

/** Wire a window's back and forward up. `onChange` is called whenever the
 *  window moves between views, so whoever draws Back and Forward can grey them
 *  out at the ends. */
export function attachNavigation(win: BrowserWindow, onChange: () => void): Navigation {
  const history = () => win.webContents.navigationHistory;
  const alive = () => !win.isDestroyed() && !win.webContents.isDestroyed();

  // The page draws a mark down the edge it went out of, so a move you asked for
  // by feel is answered by sight. Said from here, where the move happens, so
  // every way in gets it — the swipe, the menu, a mouse's own buttons — and a
  // press at either end, which moves nothing, says nothing.
  const announce = (direction: NavDirection) => {
    if (alive()) win.webContents.send(CHANNELS.navigated, direction);
  };

  const nav: Navigation = {
    canGoBack: () => alive() && history().canGoBack(),
    canGoForward: () => alive() && history().canGoForward(),
    back: () => {
      if (!nav.canGoBack()) return;
      history().goBack();
      announce("back");
    },
    forward: () => {
      if (!nav.canGoForward()) return;
      history().goForward();
      announce("forward");
    },
    reset: () => {
      if (alive()) history().clear();
      onChange();
    },
  };

  // The three-finger swipe, for a Mac set up to send it: right for the view
  // before, left for the one ahead — which way a browser reads the same swipe.
  // Up and down are a different gesture and are left to the system.
  win.on("swipe", (_event, direction) => {
    if (direction === "right") nav.back();
    else if (direction === "left") nav.forward();
  });

  // The back and forward buttons on a mouse. Windows and Linux are the systems
  // that tell an app one was pressed, and they are also the ones with no swipe,
  // so this is the gesture's stand-in there. macOS says nothing, so nothing
  // arrives and there is no platform check to keep right. Every other command a
  // keyboard or a mouse can send here — media keys and the rest — is left alone.
  win.on("app-command", (_event, command) => {
    if (command === "browser-backward") nav.back();
    else if (command === "browser-forward") nav.forward();
  });

  // A card page is a route, so most moves are the router's, not a fresh load —
  // both count.
  win.webContents.on("did-navigate", onChange);
  win.webContents.on("did-navigate-in-page", onChange);

  return nav;
}
