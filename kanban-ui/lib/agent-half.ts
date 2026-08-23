import { useCallback, useEffect, useState } from "react";

/** The boundary the card format puts between the two halves — one line, on its own
 *  (`akb guide board`, "Card format"). Written as a comment so it never renders. */
const MARKER = /^[ \t]*<!--[ \t]*agent[ \t]*-->[ \t]*\r?\n?/m;

export interface CardHalves {
  /** Everything above the boundary — what a reviewer has to read. */
  human: string;
  /** Everything below it. Empty for a card that carries no boundary, or nothing
   *  under one, and then the human half is the whole body as it has always been. */
  agent: string;
}

/** Split a card's body at the boundary (#262). */
export function splitCardBody(body: string): CardHalves {
  const marker = MARKER.exec(body);
  if (!marker) return { human: body, agent: "" };
  const human = body.slice(0, marker.index).trimEnd();
  const agent = body.slice(marker.index + marker[0].length).trim();
  if (!agent) return { human, agent: "" };
  return { human, agent };
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

/** Every card page opens with the agent half shut — nothing about the fold is remembered,
 *  so a fresh visit always reads the same way. Following a match is the one exception, and
 *  it lasts only for that visit. */
export function useAgentHalf(
  cardId: number,
  halves: CardHalves,
  title: string,
): {
  open: boolean;
  /** The element opened or shut, however it happened. */
  onToggle: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!halves.agent) return;
    // Only ever opens: a half opened by a match or by the window's own Find stays open
    // when the card is re-read from disk under it.
    if (onlyInAgentHalf(takeArmed(cardId), title, halves)) setOpen(true);
  }, [cardId, halves, title]);

  const onToggle = useCallback((next: boolean) => setOpen(next), []);

  return { open, onToggle };
}
