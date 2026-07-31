import { useCallback, useEffect, useState } from "react";

// Dialogs mount fresh every time they open, so their input `useState` starts
// empty — close a dialog by mistake (Esc, backdrop click, the × button) and the
// text you typed is gone. These hooks seed the input from localStorage instead
// and write back on every keystroke, keyed per action + card, so an accidental
// close keeps the draft and reopening restores it. Call `clear()` once the input
// has been consumed (the session started) so the next open is blank.

const PREFIX = "kanban-draft:";

// A single text draft (implement notes, a reject reason, the create description…).
export function useDraft(key: string): [string, (v: string) => void, () => void] {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState("");

  // Seed after mount: localStorage is client-only, so reading it during the first
  // render would desync SSR/hydration. A blank frame flips to the saved text.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved != null) setValue(saved);
    } catch {
      // storage unavailable (private mode / disabled) — just don't persist
    }
  }, [storageKey]);

  const set = useCallback(
    (v: string) => {
      setValue(v);
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {}
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    setValue("");
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  return [value, set, clear];
}

// Resolve carries one answer box per open question, so its draft is a list. Stored
// as a JSON array and reconciled to the current question count on load, in case
// the card's questions changed while a draft sat around.
export function useDraftList(
  key: string,
  length: number,
): [string[], (i: number, v: string) => void, () => void] {
  const storageKey = PREFIX + key;
  const [values, setValues] = useState<string[]>(() => Array(length).fill(""));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) {
        setValues(Array.from({ length }, (_, i) => (typeof arr[i] === "string" ? arr[i] : "")));
      }
    } catch {}
  }, [storageKey, length]);

  const setAt = useCallback(
    (i: number, v: string) => {
      setValues((prev) => {
        const next = prev.map((a, j) => (j === i ? v : a));
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    setValues(Array(length).fill(""));
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey, length]);

  return [values, setAt, clear];
}

// The ticked options next to those answer boxes — one list of 1-based option
// numbers per question. `seed` is what an untouched dialog opens with (the
// agent's recommendations), so clearing the draft goes back to the
// recommendations rather than to nothing. A saved draft that no longer matches
// the card's questions is dropped for the seed.
export function useDraftPicks(
  key: string,
  seed: number[][],
): [number[][], (i: number, v: number[]) => void, () => void] {
  const storageKey = PREFIX + key;
  // Serialized, so the effects below re-run when the seed's CONTENT changes and
  // not on every render that rebuilds the same array.
  const seedJson = JSON.stringify(seed);
  const [values, setValues] = useState<number[][]>(() => JSON.parse(seedJson) as number[][]);

  useEffect(() => {
    const fallback = JSON.parse(seedJson) as number[][];
    try {
      const saved = window.localStorage.getItem(storageKey);
      const arr = saved ? JSON.parse(saved) : null;
      if (Array.isArray(arr) && arr.length === fallback.length) {
        setValues(
          fallback.map((s, i) =>
            Array.isArray(arr[i]) ? arr[i].filter((n: unknown) => Number.isInteger(n)) : s,
          ),
        );
        return;
      }
    } catch {}
    setValues(fallback);
  }, [storageKey, seedJson]);

  const setAt = useCallback(
    (i: number, v: number[]) => {
      setValues((prev) => {
        const next = prev.map((p, j) => (j === i ? v : p));
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    setValues(JSON.parse(seedJson) as number[][]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey, seedJson]);

  return [values, setAt, clear];
}
