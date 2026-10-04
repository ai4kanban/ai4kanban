"use client";

// Whether the top row offers the Triage button at all (#453, #1510), and the count it carries.
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
// Opening a page is a fresh Window, and a hook starting from "no row" would take the button off
// the top row on every navigation and put it back a moment later.
let held: SignalsRow = { show: false, count: 0 };
const watching = new Set<(row: SignalsRow) => void>();

async function ask(): Promise<void> {
  held = await signalsRowAction();
  for (const tell of watching) tell(held);
}

/** Ask again — after the Inbox page adds or dismisses one, a test case is sent there, or a
 *  run ends, so the count on the button is the count on the page. */
export const reloadSignalsRow = (): void => void ask();

/** Asked when a window opens, when it is looked at again, and when a run ends — never on
 *  every tick of the board's poll: the answer reaches Cloud, and a row is not worth a request
 *  a second.
 *
 *  A board that may not use the inbox — an account not in the preview, rules older than the
 *  feature — answers `false`, and the button is simply not drawn. */
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
