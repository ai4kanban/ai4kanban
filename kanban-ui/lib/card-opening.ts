// What a card page is being opened from, marked while the page is read so a slow open shows
// on the thing clicked (app/globals.css). A quick open never shows it.

let marked: Element | null = null;

export function markOpening(el: Element, path: string) {
  if (path === window.location.pathname) return;
  clearOpening();
  el.setAttribute("data-opening", "");
  marked = el;
}

/** Clear the mark, or only `el`'s when one is named. */
export function clearOpening(el?: Element) {
  if (el && el !== marked) return;
  marked?.removeAttribute("data-opening");
  marked = null;
}

const CARD_PATH = /^\/(archive\/)?\d+$/;

/** The card page a plain click on this element would open in place, if any. */
export function cardLinkPath(e: MouseEvent): { link: Element; path: string } | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return null;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || !CARD_PATH.test(url.pathname)) return null;
  return { link, path: url.pathname };
}
