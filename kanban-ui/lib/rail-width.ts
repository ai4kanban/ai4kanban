import { useCallback, useEffect } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";

const KEY = "kanban-ui.rail-width";

/** What the rail opens at: wide enough that a title says something before it
 *  truncates, narrow enough to still read as chrome. */
export const RAIL_W = 216;
/** Where a drag stops. Below the floor a row is an id and an ellipsis; past the
 *  ceiling the rail has stopped being chrome and become a second column. */
export const RAIL_MIN = 168;
export const RAIL_MAX = 400;

function save(px: number) {
  try {
    window.localStorage.setItem(KEY, String(Math.round(px)));
  } catch {
    // storage unavailable — the width lasts as long as the window does
  }
}

// How wide you have dragged the rail, remembered across reloads.
//
// In pixels, not in the share of the window the panel group works in: the rail
// is chrome, and chrome that grows every time you widen the window is chrome you
// have to put back. That is the same reason the panel is `preserve-pixel-size`
// (see components/Window.tsx) — a wider window gives its new room to the body.
//
// Kept in the browser like the window's other state (lib/open-cards), but not
// keyed by project root the way that one is: how wide you like the rail is about
// the window, not about what is open in it.
export function useRailWidth() {
  const panel = usePanelRef();

  // Applied after mount rather than handed to the panel as its `defaultSize`,
  // for the usual reason — localStorage is client-only, and `defaultSize` is one
  // of the few things this library does render on the server, so reading it
  // during the first render would desync hydration.
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(KEY));
    } catch {
      // storage unavailable — open at the default
    }
    // The panel clamps to its own floor and ceiling, so a width saved by an
    // older build can't leave the rail somewhere it cannot be dragged back from.
    if (saved > 0) panel.current?.resize(saved);
  }, [panel]);

  // Only a drag is worth writing down, or the arrow keys that do the same thing.
  // The group also reports a layout on mount and whenever the window changes
  // size, and saving those would put the default back over the stored width
  // before the effect above has had the chance to read it.
  const onLayoutChanged = useCallback(
    (_layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      // A frame later, because the group says the layout has changed before the
      // panel has finished settling on it: held arrow keys would otherwise write
      // down the step before last.
      requestAnimationFrame(() => {
        const px = panel.current?.getSize().inPixels;
        if (px) save(px);
      });
    },
    [panel],
  );

  // Double-clicking the divider puts the rail back to `defaultSize`. The library
  // does that part itself, and reports it as something other than a user
  // interaction — so the reset is written down here, or the width you just
  // cleared would be back on the next load.
  const onDoubleClick = useCallback(() => save(RAIL_W), []);

  return { panel, onLayoutChanged, onDoubleClick };
}
