"use client";

import { createContext, useContext } from "react";

// Where the board and its cards live, as paths. The app puts a board at `/` and every card at
// `/<id>`; the hosted pages put the same two under the workspace (#322) — `/<workspace-id>`
// and `/<workspace-id>/<id>`.
//
// Context and not a prop, for the same reason `open-ids.tsx` is one: these links are drawn
// deep inside the board, the card page and every markdown body, and threading a prefix down
// each of those paths is how they fall out of step. The default is empty, which is the app.
const BoardBaseContext = createContext("");

export const BoardBaseProvider = BoardBaseContext.Provider;

/** Where one card's page is, on whichever screen is asking. */
export function useCardHref(): (id: number) => string {
  const base = useContext(BoardBaseContext);
  return (id) => `${base}/${id}`;
}

/** Where the board itself is — what a way back off a card leads to. */
export function useBoardHref(): string {
  return useContext(BoardBaseContext) || "/";
}
