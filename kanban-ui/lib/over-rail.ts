import { useEffect } from "react";

// What is layered over the chat rail (#267).
//
// Esc is answered in a handful of places and none of them tells the others the key is
// taken. The rail wants it too — while a reply is being written, Esc stops it — but only
// when nothing is over it: a dialog, a panel or a popover has first claim, and one key
// press closing a dialog AND killing a reply behind it is two things at once.
//
// A shared marker rather than the capture phase: the menus and selects already take Esc on
// `document` in the capture phase and stop it there (components/ui/select.tsx), so a rail
// listener moved ahead of them would close the dialog under an open menu. Here every layer
// keeps the Esc it answers today, and only the rail reads whether one is up.

let up = 0;

/** Say, while this layer is up, that it is over the rail. */
export function useOverRail(open: boolean = true): void {
  useEffect(() => {
    if (!open) return;
    up += 1;
    return () => {
      up -= 1;
    };
  }, [open]);
}

/** Something is over the rail, so Esc is not the rail's to answer. */
export function overRail(): boolean {
  return up > 0;
}
