"use client";

import { createContext, useContext, useMemo } from "react";

// The ids of every open card, for the `#12` → `/12` links that Markdown draws.
// It's context and not a prop because markdown is rendered in places that are
// nowhere near the board read: the run log appears inline on a card page,
// in the board's log overlay, and in the runs dialog, which hangs off the
// header and never sees a card. Threading the same list down three different
// paths is how they fell out of step in the first place — with a provider per
// page, every markdown body linkifies the same way wherever it is shown.
const OpenIdsContext = createContext<Set<number>>(new Set());

export function OpenIdsProvider({
  ids,
  children,
}: {
  ids: number[];
  children: React.ReactNode;
}) {
  const set = useMemo(() => new Set(ids), [ids]);
  return <OpenIdsContext.Provider value={set}>{children}</OpenIdsContext.Provider>;
}

export function useOpenIds(): Set<number> {
  return useContext(OpenIdsContext);
}
