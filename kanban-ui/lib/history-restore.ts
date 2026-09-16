import { useEffect, useRef } from "react";

// A page Back or Forward lands on is drawn from the router's cache, not read again (#814).
// Whatever changed on disk while the reader was away — a chat's edit to the card, most often
// — is missing from it, and nothing else notices: the page it was on already took in that
// change. So the page that history brought back is told, and reads itself as if opened.

/** Where the last Back or Forward landed, until a page there takes it. */
let popped: string | null = null;
let watching = false;

function watch(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("popstate", () => {
    popped = window.location.pathname;
  });
}

watch();

/** Run `fn` once when this page was brought back by Back or Forward. */
export function useOnHistoryRestore(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (popped !== window.location.pathname) return;
    popped = null;
    ref.current();
  }, []);
}
