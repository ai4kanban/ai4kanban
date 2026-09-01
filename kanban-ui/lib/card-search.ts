import { useEffect, useState } from "react";
import { searchCardsAction } from "@/app/actions";
import type { CardRef } from "./types";

// What is typed, and the cards it found. The board is searched on the server
// (app/actions) because no page the search is drawn in holds the words to search: the board
// page has the cards its columns show and not a group's subtasks, and a card page has the
// one card it is showing.
//
// It lives here rather than in the rail because the phone draws the same search as a screen
// of its own (#357) — two shapes, one search.

/** How long the typing has to stop before the board is searched. Long enough that a
 *  word is one search and not six, short enough that it lands while the finger is
 *  still coming off the key. */
const SEARCH_PAUSE = 120;

/**
 * `matches` is the answer to the LAST search that came back, not to what is in the box this
 * instant. It is deliberately kept while the next one is in flight — dropping it would flash
 * the list empty on every keystroke — and it is null only until the first answer of a search
 * arrives, which is the one moment there is nothing honest to draw. That is also why "No
 * card matches" is tied to an empty answer rather than to an empty `matches`: a search still
 * running must not read as a search that found nothing.
 */
export function useCardSearch(): {
  query: string;
  setQuery: (q: string) => void;
  matches: CardRef[] | null;
} {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CardRef[] | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (!q) {
      setMatches(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      searchCardsAction(q)
        .then((found) => {
          if (live) setMatches(found);
        })
        .catch(() => {
          // The board couldn't be read. Nothing found is the honest answer, and
          // the pages that can explain why already do.
          if (live) setMatches([]);
        });
    }, SEARCH_PAUSE);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  return { query, setQuery, matches };
}
