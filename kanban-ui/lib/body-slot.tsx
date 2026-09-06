"use client";

import { createContext, useContext } from "react";

// The window's body — the paper the board or a card page is drawn on (components/Window.tsx).
//
// A screen that replaces the board rather than the window portals into this instead of
// `document.body`, so the top row and the rail stay where they are and the reader keeps
// their place. Null outside a Window; the caller falls back to the whole viewport.

const BodySlot = createContext<HTMLElement | null>(null);

export const BodySlotProvider = BodySlot.Provider;

export const useBodySlot = (): HTMLElement | null => useContext(BodySlot);
