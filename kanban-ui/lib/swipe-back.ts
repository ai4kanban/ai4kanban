import { useEffect, useRef } from "react";

// What the two-finger swipe back leaves (#526).
//
// The gesture is read in the app's preload script (desktop/src/preload.ts), which is the
// only place it exists at all — Electron leaves Chromium's own swipe off. That script
// cannot reach this code, so it asks the page first: it dispatches `a4k:swipe-back` on the
// window, and moves the page history only when nothing here took it. Cancelling the event
// is how a layer says it did.
//
// One layer per gesture, topmost first. A view registers while it is up and the last one
// registered is the one on top — the order things open in is the order they lie in, which
// is why nothing here has to know what a Configuration dialog is or what it was opened
// over. Only views that cover the page register; a popover or a small panel is left with
// the click outside and the Escape it already has, exactly as with `overRail`.

/** The event the app's preload script announces the gesture with. Written out in both
 *  places rather than shared — the preload script is sandboxed and can import nothing
 *  from here (desktop/src/preload.ts). */
export const SWIPE_BACK = "a4k:swipe-back";

const layers: { dismiss: () => void }[] = [];

/** While `open`, this view is what the swipe back leaves — before the page underneath
 *  moves, and before any layer it was opened over. */
export function useSwipeBack(open: boolean, onBack: () => void): void {
  const held = useRef(onBack);
  held.current = onBack;
  useEffect(() => {
    if (!open) return;
    const layer = { dismiss: () => held.current() };
    layers.push(layer);
    return () => {
      const at = layers.indexOf(layer);
      if (at >= 0) layers.splice(at, 1);
    };
  }, [open]);
}

/** Take the top layer off, if there is one. */
export function dismissTopLayer(): boolean {
  const layer = layers[layers.length - 1];
  if (!layer) return false;
  layer.dismiss();
  return true;
}

// How the gesture knows there is nowhere left to go back to.
//
// `history.length` never shrinks, so it cannot answer this: it counts the entries a window
// has ever held, not the ones this app put there. What is counted instead is the views
// opened since the window did — the number is stamped on each entry as it is pushed, so
// coming back to an entry brings its own number with it and a reload keeps it.

const VIEW = "__a4kView";
let depth = 0;
let counting = false;

function stamp(state: unknown, at: number): unknown {
  return typeof state === "object" && state !== null
    ? { ...(state as object), [VIEW]: at }
    : { [VIEW]: at };
}

function countViews(): void {
  if (counting) return;
  counting = true;
  const h = window.history;
  // A reload keeps the entry it landed on, and the number is on it — so a card reloaded
  // three views deep is still three views deep, not somewhere with nothing behind it.
  const landed = (h.state as Record<string, unknown> | null)?.[VIEW];
  if (typeof landed === "number") depth = landed;
  const push = h.pushState.bind(h);
  const replace = h.replaceState.bind(h);
  h.pushState = (state, unused, url) => push(stamp(state, ++depth), unused, url);
  h.replaceState = (state, unused, url) => replace(stamp(state, depth), unused, url);
  window.addEventListener("popstate", (e) => {
    const at = (e.state as Record<string, unknown> | null)?.[VIEW];
    depth = typeof at === "number" ? at : 0;
  });
  // The entry the window opened on, so the first view is numbered like every other.
  replace(stamp(h.state, depth), "");
}

/** Nothing in the app was opened before this view, so there is no page to go back to. */
export function atFirstView(): boolean {
  return depth <= 0;
}

/** Start counting. Called once, by whoever listens for the gesture. */
export function watchViews(): void {
  if (typeof window !== "undefined") countViews();
}
