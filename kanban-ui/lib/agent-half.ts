import { useCallback, useEffect, useRef, useState } from "react";

/** The boundary the card format puts between the two halves — one line, on its own
 *  (`akb guide board`, "Card format"). Written as a comment so it never renders. */
const MARKER = /^[ \t]*<!--[ \t]*agent[ \t]*-->[ \t]*\r?\n?/m;

/** A `##` heading, at line start, with a word after it. `###` is a subsection of the
 *  section above it, so it is not one of these. */
const SECTION = /^ {0,3}##[ \t]+\S/;

const FENCE = /^ {0,3}(```|~~~)/;

export interface CardHalves {
  /** Everything above the boundary — what a reviewer has to read. */
  human: string;
  /** Everything below it. Empty for a card that carries no boundary, or nothing
   *  under one, and then the human half is the whole body as it has always been. */
  agent: string;
  /** How many `##` sections the agent half holds. */
  sections: number;
}

/** Split a card's body at the boundary (#262). */
export function splitCardBody(body: string): CardHalves {
  const marker = MARKER.exec(body);
  if (!marker) return { human: body, agent: "", sections: 0 };
  const human = body.slice(0, marker.index).trimEnd();
  const agent = body.slice(marker.index + marker[0].length).trim();
  if (!agent) return { human, agent: "", sections: 0 };
  return { human, agent, sections: countSections(agent) };
}

function countSections(text: string): number {
  let fenced = false;
  let found = 0;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && SECTION.test(line)) found += 1;
  }
  return found;
}

/** Whether the typed word is on the card only below the boundary — so a page that opens
 *  with the agent half shut would show nothing the search found. Judged the way the rail's
 *  search judges a match (lib/board.ts): the word as one string, case ignored. */
export function onlyInAgentHalf(word: string, title: string, halves: CardHalves): boolean {
  const q = word.trim().toLowerCase();
  if (!q || !halves.agent) return false;
  if (!halves.agent.toLowerCase().includes(q)) return false;
  return !title.toLowerCase().includes(q) && !halves.human.toLowerCase().includes(q);
}

// Whether the reader leaves the agent half open, remembered across cards and reloads.
//
// One setting for every card, not one per card: keeping the detail open is a habit about
// how you read. Kept in the browser beside the rail's width and its Memory panel, and not
// in the board's files — it stays on this machine and never travels with the repo.
const KEY = "kanban-ui.agent-half-open";

// The word a match in the rail's list was clicked with, and the card it leads to (#262).
//
// Held here rather than in the address, because the exception belongs to the act of
// following a match and not to the card: a module variable dies with the page, so a reload
// is an ordinary visit again. Every click re-arms it, so a whole search's worth of matches
// open this way and not only the first.
let armed: { id: number; word: string } | null = null;

export function armAgentHalf(id: number, word: string): void {
  const typed = word.trim();
  armed = typed ? { id, word: typed } : null;
}

function takeArmed(id: number): string {
  const word = armed && armed.id === id ? armed.word : "";
  armed = null;
  return word;
}

export function useAgentHalf(
  cardId: number,
  halves: CardHalves,
  title: string,
): {
  open: boolean;
  /** The reader worked the control — this toggle is the one that gets written down. */
  byHand: () => void;
  /** The element opened or shut, however it happened. */
  onToggle: (open: boolean) => void;
} {
  // Shut for the first render, always: localStorage is client-only, so a remembered
  // `true` read during the render would desync hydration. It lands a frame later.
  const [open, setOpen] = useState(false);
  const hand = useRef(false);

  useEffect(() => {
    if (!halves.agent) return;
    // Following a match opens the half for this visit only, and never writes the setting.
    if (onlyInAgentHalf(takeArmed(cardId), title, halves)) {
      setOpen(true);
      return;
    }
    let saved = false;
    try {
      saved = window.localStorage.getItem(KEY) === "1";
    } catch {
      // storage unavailable — the half opens shut and lasts as long as the window does
    }
    // Only ever opens: a half opened by a match or by the window's own Find stays open
    // when the card is re-read from disk under it.
    if (saved) setOpen(true);
  }, [cardId, halves, title]);

  const byHand = useCallback(() => {
    hand.current = true;
  }, []);

  const onToggle = useCallback((next: boolean) => {
    setOpen(next);
    if (!hand.current) return;
    hand.current = false;
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  }, []);

  return { open, byHand, onToggle };
}
