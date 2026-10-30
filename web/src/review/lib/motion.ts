import { useEffect, useRef, useState } from "react";

/** Keeps a popup drawn for `ms` after `open` turns false, so `.nb-pop[data-closing]` can fade it out. */
export function useShown(open: boolean, ms = 120): boolean {
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) return setShown(true);
    const t = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return open || shown;
}

/** The attribute that plays a popup's way out. */
export const closing = (open: boolean) => (open ? undefined : "");

/** Whether an id arrived after the list first loaded (`ids` is null while it loads), so only new rows play their way in. */
export function useArrived(ids: readonly (string | number)[] | null): (id: string | number) => boolean {
  const seen = useRef<Set<string | number> | null>(null);
  if (ids && !seen.current) seen.current = new Set(ids);
  return (id) => !!seen.current && !seen.current.has(id);
}
