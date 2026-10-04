// The welcome tour's two ways in (#1500): asked for again from anywhere on the page, and the
// once-per-browser record a surface with no machine settings keeps (Cloud).

const EVENT = "a4k:welcome-tour";
const KEY = "a4k.welcomeTourShown";

export const welcomeTour = {
  open() {
    window.dispatchEvent(new Event(EVENT));
  },
  onOpen(fn: () => void): () => void {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  },
};

export const browserTourRecord = {
  shown(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return true;
    }
  },
  record() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Not saved: the tour comes back next time.
    }
  },
};
