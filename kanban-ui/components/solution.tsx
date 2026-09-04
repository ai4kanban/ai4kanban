"use client";

import { createContext, useContext } from "react";
import type { Solution } from "@/lib/types";

// What the open board's work IS (#411) — which face its cards wear, and which block its
// card page draws. It comes down with the screen (`ScreenBoard.solution`), read on the
// server so the first paint is already the right one.
//
// Context and not a prop, for the reason `open-ids.tsx` is one: the face is drawn deep
// inside the columns and the queue, and threading a word down each of those paths is how
// they fall out of step. `product` is the default, so every screen with no provider over it
// — the design gallery, a hosted board — draws exactly what it drew before.
const SolutionContext = createContext<Solution>("product");

export const SolutionProvider = SolutionContext.Provider;

/** What this board's work is. */
export function useSolution(): Solution {
  return useContext(SolutionContext);
}
