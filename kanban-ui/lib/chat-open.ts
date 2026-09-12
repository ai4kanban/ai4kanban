import { useSyncExternalStore } from "react";

// Asking the window to open one card's chat, from somewhere else on the screen (#633).
//
// Two presses want it and neither can reach the rail's state: the card page's **Edit**,
// which IS the card's conversation now that the edit dialog is gone, and a card's row in the
// rail's Discussions list, which is on the board screen and has to navigate first. The rail
// belongs to the window (lib/chat-rail.ts), so they meet on this store.
//
// The same shape as the create sheet's (lib/create-open.ts), for the same reason: a fresh
// object every ask, so asking twice still reaches a rail the user folded in between.

let request: { at: number; cardId: number } | null = null;
const subs = new Set<() => void>();

export const cardChat = {
  /** Open this card's conversation. On another page it is the window arriving on that card
   *  that acts on it, so a row press and the navigation it starts are one move. */
  open(cardId: number) {
    request = { at: request ? request.at + 1 : 1, cardId };
    for (const fn of subs) fn();
  },
};

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

/** The last ask, for the window holding the rail. */
export function useCardChatRequest(): { at: number; cardId: number } | null {
  return useSyncExternalStore(
    subscribe,
    () => request,
    () => request,
  );
}
