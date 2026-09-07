"use client";

// Whether the window offers the market signal row at all (#453), and the count it carries.
//
// Its own module rather than a part of components/Signals.tsx: the window asks for the row on
// every screen, and that page is drawn inside the window — one file holding both would be an
// import ring around a hook.

import { useCallback, useEffect, useState } from "react";
import { signalsRowAction } from "@/app/actions";
import { useOnTabFocus } from "./sessions";

export interface SignalsRow {
  show: boolean;
  count: number;
}

// The last answer, held for the tab rather than for the component, and the hooks watching it.
// Opening a page is a fresh Window, and a hook starting from "no row" would take the row off
// the rail on every navigation and put it back a moment later — including on the signals page
// itself, where it is the mark saying where you are.
let held: SignalsRow = { show: false, count: 0 };
const watching = new Set<(row: SignalsRow) => void>();

async function ask(): Promise<void> {
  held = await signalsRowAction();
  for (const tell of watching) tell(held);
}

/** Ask again — what the signals page calls once it has dismissed one, so the count on the rail
 *  is the count on the page. */
export const reloadSignalsRow = (): void => void ask();

/** Asked when a window opens and again when the window is looked at again, never on the
 *  board's poll: the answer reaches Cloud, and a row is not worth a request a second.
 *
 *  A board that may not use the inbox — a Marketing one, an account not in the preview, rules
 *  older than the feature — answers `false`, and the row is simply not drawn. */
export function useSignalsRow(): SignalsRow {
  const [row, setRow] = useState(held);
  useEffect(() => {
    watching.add(setRow);
    return () => void watching.delete(setRow);
  }, []);
  const read = useCallback(() => void ask(), []);
  useEffect(read, [read]);
  useOnTabFocus(read);
  return row;
}
