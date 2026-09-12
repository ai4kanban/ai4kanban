"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { archiveDiscussionAction, listDiscussionsAction } from "@/app/actions";
import { usePhone } from "./media";
import type { ChatTarget, ConversationRow } from "./types";

// The conversations the rail lists (#496, #633): the board's discussions, and one row per
// open card with a chat going.
//
// One poll for the whole window: the rows say what each one is called and which is being
// answered, both of which move while nobody is looking — a reply started in the Create sheet
// or on a card page goes on arriving after that screen is shut, and a terminal writes the
// same files.
//
// Nothing is held here. The list is the `chats/` files on this machine, read through the
// board's own rules, so two windows on one board draw the same rows.

/** How often the rows are re-read: quick while a reply is being written somewhere, slow
 *  otherwise — a name changes when a plan is named, which is not a thing to chase. */
const LIVE_MS = 3000;
const IDLE_MS = 6000;

export interface DiscussionList {
  rows: ConversationRow[];
  /** Take one out of the list, and drop its row on the spot rather than waiting out a tick.
   *  A refusal puts the row back and says why, so nothing is lost off the rail that is still
   *  on disk (#610). */
  archive(target: ChatTarget): Promise<{ ok: boolean; error?: string }>;
}

/** `off` is a board that holds no conversations to list at all — a marketing one (#507),
 *  where a discussion's row would open a sheet that board does not have. Nothing is read
 *  then, the way nothing is read at phone width. */
export function useDiscussions(off = false): DiscussionList {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const kickRef = useRef<() => void>(() => {});
  // At phone width there is no rail to draw them in, so nothing is read at all.
  const phone = usePhone();
  const answering = rows.some((row) => row.answering);

  useEffect(() => {
    if (phone || off) {
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
  }, [phone, off, answering]);

  const archive = useCallback(async (target: ChatTarget) => {
    setRows((was) => was.filter((row) => row.target !== target));
    const done = await archiveDiscussionAction(target);
    // Either way the list is re-read: it puts a refused row back, and confirms the rest.
    kickRef.current();
    return done;
  }, []);

  return { rows, archive };
}
