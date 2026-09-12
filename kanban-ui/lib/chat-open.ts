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

/** What the press meant. `edit` is the card page's Edit button, which also wants the caret
 *  in the box and the opening line already typed; pressed again it folds the rail back
 *  away. `open` only ever shows the conversation. */
export type ChatAsk = "open" | "edit";

let request: { at: number; cardId: number; kind: ChatAsk } | null = null;
const subs = new Set<() => void>();

function ask(cardId: number, kind: ChatAsk) {
  request = { at: request ? request.at + 1 : 1, cardId, kind };
  for (const fn of subs) fn();
}

export const cardChat = {
  /** Open this card's conversation. On another page it is the window arriving on that card
   *  that acts on it, so a row press and the navigation it starts are one move. */
  open(cardId: number) {
    ask(cardId, "open");
  },
  /** The card page's Edit: open this card's conversation ready to be typed in, or fold it
   *  away again if this is what opened it. */
  edit(cardId: number) {
    ask(cardId, "edit");
  },
};

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

/** The last ask, for the window holding the rail. */
export function useCardChatRequest(): { at: number; cardId: number; kind: ChatAsk } | null {
  return useSyncExternalStore(
    subscribe,
    () => request,
    () => request,
  );
}
