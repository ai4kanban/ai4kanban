// Copied from legacy kanban-ui/components/copy.tsx: words onto the clipboard (#269), and
// saying so. The picture copy is trimmed.

import { useCallback, useEffect, useState } from "react";
import { useCopy } from "../i18n";

/** How long the icon stays a check before going back to being a copy button. */
const COPIED_MS = 1600;

/** A copy button's state: whether it just worked, and how to copy.
 *
 *  A copy that fails says nothing. Where there is no clipboard the words are on screen to
 *  select by hand, and claiming a copy that never happened is worse than saying nothing. */
export function useCopyText(): { copied: boolean; copy(text: string): void } {
  const [copied, setCopied] = useCopied();
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard
        ?.writeText(text)
        .then(() => setCopied(true))
        .catch(() => {});
    },
    [setCopied],
  );
  return { copied, copy };
}

/** True for COPIED_MS after it is set. */
function useCopied(): [boolean, (on: boolean) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return [copied, setCopied];
}

/** The word a screen reader hears when a copy worked. Always in the DOM, empty at rest: a
 *  live region added at the same moment as its text is announced by no reader reliably. */
export function Copied({ on }: { on: boolean }) {
  const c = useCopy().shared;
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {on ? c.copied : ""}
    </span>
  );
}
