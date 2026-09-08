"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { archiveDiscussionAction, listDiscussionsAction } from "@/app/actions";
import { usePhone } from "./media";
import type { DiscussionRow, DiscussionTarget } from "./types";

// The discussions the rail lists (#496).
//
// One poll for the whole window: the rows say what each discussion is called and which one
// its agent is answering, both of which move while nobody is looking — a reply started in the
// Create sheet goes on arriving after the sheet is shut, and a terminal writes the same files.
//
// Nothing is held here. The list is the `.chats/` files on this machine, read through the
// board's own rules, so two windows on one board draw the same rows.

/** How often the rows are re-read: quick while a reply is being written somewhere, slow
 *  otherwise — a name changes when a plan is named, which is not a thing to chase. */
const LIVE_MS = 3000;
const IDLE_MS = 6000;

export interface DiscussionList {
  rows: DiscussionRow[];
  /** Take one out of the list, and drop its row on the spot rather than waiting out a tick. */
  archive(target: DiscussionTarget): Promise<void>;
}

export function useDiscussions(): DiscussionList {
  const [rows, setRows] = useState<DiscussionRow[]>([]);
  const kickRef = useRef<() => void>(() => {});
  // At phone width there is no rail to draw them in, so nothing is read at all.
  const phone = usePhone();
  const answering = rows.some((row) => row.answering);

  useEffect(() => {
    if (phone) {
      setRows([]);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = await listDiscussionsAction();
        if (alive) setRows(next);
      } catch {
        // transient — the next tick tries again
      } finally {
        inFlight = false;
      }
      if (!alive) return;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        timer = setTimeout(tick, answering ? LIVE_MS : IDLE_MS);
      }
    };
    kickRef.current = () => {
      if (!alive) return;
      clearTimeout(timer);
      void tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") kickRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phone, answering]);

  const archive = useCallback(async (target: DiscussionTarget) => {
    setRows((was) => was.filter((row) => row.target !== target));
    await archiveDiscussionAction(target);
    kickRef.current();
  }, []);

  return { rows, archive };
}
