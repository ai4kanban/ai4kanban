import { useEffect, useState } from "react";

// The window's widths, answered in JavaScript. Most of the board's responsive work is CSS
// — a class is cheaper than a listener and it is right in the first paint. This is for the
// two things CSS cannot do: change which markup is drawn, and tell a component which shape
// it is in.

/** Phone width. The same line the rail already goes at (app/globals.css), so the rail
 *  going and the phone shell arriving are one move rather than two that nearly agree. */
export const PHONE_UNDER = "(width < 48rem)";

/** A media query, answered after mount. False during the server render and the first
 *  paint, so the markup the server sent and the first client render agree; the phone
 *  shell arrives one frame later. */
export function useMatches(query: string): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setYes(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return yes;
}

/** Whether the board is being read on a phone-width screen (#357). */
export function usePhone(): boolean {
  return useMatches(PHONE_UNDER);
}
