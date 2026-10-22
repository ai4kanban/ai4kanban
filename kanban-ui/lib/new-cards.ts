"use client";

// The cards a discussion wrote that nobody has opened yet (#1954), per board and on this
// browser only. Opening a card's page clears its mark; a card gone from the board drops it.

import { createContext, useContext, useSyncExternalStore } from "react";

const KEY = "kanban-ui.new-cards:";
// A card is marked as it is written, which can be a beat before the board's next read has it.
const GRACE_MS = 60_000;

type Mark = { id: number; at: number };

const EMPTY: ReadonlySet<number> = new Set();
const listeners = new Set<() => void>();
const sets = new Map<string, { raw: string | null; ids: ReadonlySet<number> }>();

function rawOf(board: string): string | null {
  try {
    return window.localStorage.getItem(KEY + board);
  } catch {
    return null;
  }
}

function marksOf(raw: string | null): Mark[] {
  try {
    const saved = JSON.parse(raw ?? "[]");
    return Array.isArray(saved) ? saved.filter((m) => Number.isInteger(m?.id) && typeof m?.at === "number") : [];
  } catch {
    return [];
  }
}

function write(board: string, marks: Mark[]) {
  try {
    if (marks.length) window.localStorage.setItem(KEY + board, JSON.stringify(marks));
    else window.localStorage.removeItem(KEY + board);
  } catch {
    // storage unavailable — the marks last until a reload
  }
  for (const l of listeners) l();
}

export const newCards = {
  add(board: string, ids: number[]) {
    const marks = marksOf(rawOf(board));
    const fresh = ids.filter((id) => !marks.some((m) => m.id === id));
    if (fresh.length) write(board, [...marks, ...fresh.map((id) => ({ id, at: Date.now() }))]);
  },
  seen(board: string, id: number) {
    const marks = marksOf(rawOf(board));
    if (marks.some((m) => m.id === id)) write(board, marks.filter((m) => m.id !== id));
  },
  /** Drop the marks of cards no longer on the board. */
  keep(board: string, onBoard: ReadonlySet<number>) {
    const marks = marksOf(rawOf(board));
    const kept = marks.filter((m) => onBoard.has(m.id) || Date.now() - m.at < GRACE_MS);
    if (kept.length !== marks.length) write(board, kept);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function snapshot(board: string): ReadonlySet<number> {
  const raw = rawOf(board);
  const was = sets.get(board);
  if (was?.raw === raw) return was.ids;
  const ids: ReadonlySet<number> = new Set(marksOf(raw).map((m) => m.id));
  sets.set(board, { raw, ids });
  return ids;
}

export function useNewCards(board: string): ReadonlySet<number> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(board),
    () => EMPTY,
  );
}

/** The board's new cards, for the cards and columns drawing them. Empty off the board. */
export const NewCardsContext = createContext<ReadonlySet<number>>(EMPTY);
export const useNewCardSet = () => useContext(NewCardsContext);
