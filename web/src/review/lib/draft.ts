import { useState } from "react";

const PREFIX = "nb.draft.";

/** The text kept under `key`, null when there is none. */
export function keptDraft(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** A box's unsent text, kept in this browser under `key` so a reload or a closed popover keeps
 *  it; set "" once it is sent. No key keeps nothing. */
export function useDraft(key: string | undefined, initial = "") {
  const [state, setState] = useState(() => ({ key, text: keptDraft(key) ?? initial }));
  let current = state;
  if (state.key !== key) {
    current = { key, text: keptDraft(key) ?? initial };
    setState(current);
  }
  const set = (text: string) => {
    setState({ key, text });
    if (!key) return;
    try {
      if (text) localStorage.setItem(PREFIX + key, text);
      else localStorage.removeItem(PREFIX + key);
    } catch {}
  };
  return [current.text, set] as const;
}
