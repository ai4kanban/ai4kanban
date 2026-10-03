"use client";

// Whether the window offers the Test cases row (#1422): only on a project that has a case.
// Held for the tab, like the inbox row, so a page change does not take the row away and put
// it back a moment later.

import { useCallback, useEffect, useState } from "react";
import { testCasesRowAction } from "@/app/actions";
import { useOnTabFocus } from "./sessions";

let held = false;
const watching = new Set<(show: boolean) => void>();

async function ask(): Promise<void> {
  held = await testCasesRowAction().catch(() => false);
  for (const tell of watching) tell(held);
}

export function useTestCasesRow(): boolean {
  const [show, setShow] = useState(held);
  useEffect(() => {
    watching.add(setShow);
    return () => void watching.delete(setShow);
  }, []);
  const read = useCallback(() => void ask(), []);
  useEffect(read, [read]);
  useOnTabFocus(read);
  return show;
}
