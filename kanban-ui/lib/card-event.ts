"use client";

// Where the window's bell sits, and the one question a card page asks it (#319).
//
// Split out of components/Notifications.tsx (#374): the bell — its pane, its rows and the
// two board actions behind them — is the app's own shell, and a card page needs none of it
// to ask whether this card has a live Cloud event. A screen drawn with no bell around it
// gets `null` and draws no mark, which is exactly right.

import { createContext, useContext } from "react";
import type { BellRail } from "./bell-rail";
import type { NotificationRow } from "./notifications";

// The rail's state belongs to the window and the button is in the top row, which the page
// builds. Context is what puts the two on one state without every page threading it through
// its header — the same seam the chat rail sits behind.
const BellContext = createContext<BellRail | null>(null);

export const BellProvider = BellContext.Provider;

/** The bell this window is showing, or null where there is none. */
export const useBell = (): BellRail | null => useContext(BellContext);

/**
 * The live Cloud event on one of THIS board's cards, or null.
 *
 * Matched on the board's own Cloud id as well as the task number: the bell carries every
 * enabled board, and two boards can each hold a card #12.
 */
export function useCardEvent(taskId: number): NotificationRow | null {
  const rail = useBell();
  if (!rail) return null;
  const { center } = rail;
  if (!center.boardId) return null;
  return (
    center.rows.find((row) => row.boardId === center.boardId && row.taskId === taskId) ?? null
  );
}
