import { useCallback, useEffect, useMemo, useState } from "react";

/** A card the window has open — its id and the title the rail draws. The title
 *  is kept here rather than looked up, because the rail is drawn on a card page
 *  too, which holds one card and not the board. */
export interface OpenCard {
  id: number;
  title: string;
}

const PREFIX = "kanban-ui.open-cards:";

const isCard = (v: unknown): v is OpenCard =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as OpenCard).id === "number" &&
  typeof (v as OpenCard).title === "string";

// Which cards the window has open, for the rail down the left (see
// app/design/layouts). A desktop window has no back gesture and no back button,
// so opening a card has to leave something on screen that is also the way out of
// it — that something is a row here.
//
// The rules, in one place:
//
//   - Landing on a card opens it. Every route in is the same one — a board card,
//     a subtask, a `#12` in a body, a link someone pasted — so the card page
//     says which card it is showing and the list takes it from there.
//   - A card already open is not opened twice; its title is refreshed instead,
//     so an edited title doesn't leave the old words in the rail.
//   - A card that has left the board — archived, rejected, deleted by hand — is
//     dropped. `openIds` is the board's own list of open cards, so the rail can
//     never offer a row that leads nowhere.
//   - Closing a row leaves the list. What the window then shows is the caller's
//     to decide (see Rail): the neighbouring card, or the board.
//
// Kept in the browser, keyed by project root, like the release pick: it is what
// one window is looking at, not something the board says, and nothing here is
// written to the files. Seeded after mount for the same reason too —
// localStorage is client-only, so reading it during the first render would
// desync SSR and hydration. The card on screen is merged in at render, so that
// first frame still shows the row you are standing on.
export function useOpenCards(
  projectRoot: string,
  /** Every card the board holds open. Empty is "we don't know" — a board that
   *  failed to read — and prunes nothing. */
  openIds: number[],
  /** The card this page is showing, if it is showing one. */
  currentId: number | null = null,
  currentTitle = "",
): { rows: OpenCard[]; close: (id: number) => void } {
  const storageKey = PREFIX + projectRoot;
  const [cards, setCards] = useState<OpenCard[]>([]);
  // Nothing is written back before the first read, or the empty list this
  // starts at would overwrite the window's real one on every page load.
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let saved: unknown = [];
    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    } catch {
      // storage unavailable, or a value from an older shape — start empty
    }
    setCards(Array.isArray(saved) ? saved.filter(isCard) : []);
    setSeeded(true);
  }, [storageKey]);

  // The card on screen joins the list, or has its title brought up to date.
  useEffect(() => {
    if (currentId === null) return;
    setCards((prev) => {
      const at = prev.findIndex((c) => c.id === currentId);
      if (at < 0) return [...prev, { id: currentId, title: currentTitle }];
      if (prev[at].title === currentTitle) return prev;
      const next = prev.slice();
      next[at] = { id: currentId, title: currentTitle };
      return next;
    });
  }, [currentId, currentTitle]);

  // A string, so the set is rebuilt when the board's cards change and not when
  // the same list arrives in a new array — which is every render on a page that
  // defaults it.
  const idKey = openIds.join(",");
  const onBoard = useMemo(
    () => new Set(idKey ? idKey.split(",").map(Number) : []),
    [idKey],
  );
  useEffect(() => {
    if (onBoard.size === 0) return;
    setCards((prev) => {
      const next = prev.filter((c) => onBoard.has(c.id));
      return next.length === prev.length ? prev : next;
    });
  }, [onBoard]);

  useEffect(() => {
    if (!seeded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cards));
    } catch {}
  }, [storageKey, cards, seeded]);

  const close = useCallback((id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // The card on screen shows in the rail from the first frame, before the seed
  // above has landed — a window that opened straight onto a card would
  // otherwise draw a rail that doesn't hold the card you are reading.
  const rows = useMemo(() => {
    if (currentId === null || cards.some((c) => c.id === currentId)) return cards;
    return [...cards, { id: currentId, title: currentTitle }];
  }, [cards, currentId, currentTitle]);

  return { rows, close };
}
