"use client";

// A file dropped where the app has no use for it does nothing (#511). Without this the
// browser opens that file in place of the board and takes the unsent draft with it.
//
// One handler over the window, not a drop zone: it stops that default and nothing else, so
// the message box and the Signals inbox — which answer their own drop first — are untouched,
// and a later drop target has to ask for its own file rather than inherit one.

import { useEffect } from "react";

export function DropGuard() {
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      // Only a drag carrying a file. Text dragged around the page is the caret's.
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);
  return null;
}
