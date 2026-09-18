import { useCallback, useEffect, useRef, useState } from "react";

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

/** A piece of the human half: prose, or one ``## By `<name>` agent`` section (#870). */
export type HumanPiece =
  | { kind: "text"; body: string }
  /** `key` tells apart two sections by the same agent, in the order they appear. */
  | { kind: "agent"; name: string; key: string; body: string };

const SECTION = /^##[ \t]+By[ \t]+`?([^`\s]+)`?[ \t]+agent[ \t]*$/;
const H2 = /^##[ \t]/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Cut the human half at its agent sections. A section runs to the next `##` heading or the
 *  end of the half; a `##` line inside a fenced block is not a heading. */
export function splitHuman(human: string): HumanPiece[] {
  const pieces: HumanPiece[] = [];
  const seen = new Map<string, number>();
  let lines: string[] = [];
  let agent: string | null = null;
  let fence = "";
  const flush = () => {
    const body = lines.join("\n").trim();
    if (agent) {
      const n = seen.get(agent) ?? 0;
      seen.set(agent, n + 1);
      pieces.push({ kind: "agent", name: agent, key: `${agent}#${n}`, body });
    } else if (body) {
      const last = pieces[pieces.length - 1];
      if (last?.kind === "text") last.body += `\n\n${body}`;
      else pieces.push({ kind: "text", body });
    }
    lines = [];
  };
  for (const line of human.split(/\r?\n/)) {
    const f = FENCE.exec(line)?.[1];
    if (fence) {
      if (f && f[0] === fence[0] && f.length >= fence.length && !line.trim().slice(f.length).trim()) fence = "";
    } else if (f) {
      fence = f;
    } else if (H2.test(line)) {
      flush();
      const m = SECTION.exec(line.trim());
      agent = m ? m[1]! : null;
      if (m) continue;
    }
    lines.push(line);
  }
  flush();
  return pieces;
}

/** The typed word, when a page opening with every fold shut would show none of it: not in
 *  the title nor the prose outside the folds. Judged the way the rail's search judges a match
 *  (lib/board.ts): the word as one string, case ignored. */
function hiddenWord(word: string, title: string, pieces: HumanPiece[]): string {
  const q = word.trim().toLowerCase();
  if (!q) return "";
  const shown = [title, ...pieces.filter((p) => p.kind === "text").map((p) => p.body)];
  return shown.some((s) => s.toLowerCase().includes(q)) ? "" : q;
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

/** Every fold on a card page — the agent half and each agent section — opens shut, and
 *  nothing about them is remembered, so a fresh visit always reads the same way. What opens
 *  one on its own, and only ever opens (a fold the reader opened stays open):
 *  - a section an open question names by its `agent`, when the page opens;
 *  - a fold holding the word a search match was followed with, when nothing shown does;
 *  - a re-read that changes a fold or adds one (#814) — the change would otherwise land
 *    where the reader cannot see it. */
export function useCardFolds(
  cardId: number,
  halves: CardHalves,
  pieces: HumanPiece[],
  title: string,
  asking: string[],
): {
  isOpen: (key: string) => boolean;
  /** The element opened or shut, however it happened. */
  onToggle: (key: string, open: boolean) => void;
} {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const drawn = useRef<{ id: number; folds: Map<string, string> } | null>(null);

  useEffect(() => {
    const folds = new Map<string, string>();
    for (const p of pieces) if (p.kind === "agent") folds.set(p.key, p.body);
    if (halves.agent) folds.set(AGENT_HALF, halves.agent);
    const was = drawn.current;
    drawn.current = { id: cardId, folds };

    const opening: string[] = [];
    if (was?.id === cardId) {
      for (const [key, body] of folds) if (was.folds.get(key) !== body) opening.push(key);
    } else {
      setOpen(new Set());
      const word = hiddenWord(takeArmed(cardId), title, pieces);
      for (const p of pieces) if (p.kind === "agent" && asking.includes(p.name)) opening.push(p.key);
      if (word) for (const [key, body] of folds) if (body.toLowerCase().includes(word)) opening.push(key);
    }
    if (opening.length) setOpen((prev) => new Set([...prev, ...opening]));
    // `asking` is read only as the page opens, so an answered question leaves its section be.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, halves, pieces, title]);

  const isOpen = useCallback((key: string) => open.has(key), [open]);
  const onToggle = useCallback((key: string, next: boolean) => {
    setOpen((prev) => {
      if (prev.has(key) === next) return prev;
      const set = new Set(prev);
      if (next) set.add(key);
      else set.delete(key);
      return set;
    });
  }, []);

  return { isOpen, onToggle };
}

/** The agent half's key among the folds; no section key can take it (they carry a `#`). */
export const AGENT_HALF = "agent-half";
