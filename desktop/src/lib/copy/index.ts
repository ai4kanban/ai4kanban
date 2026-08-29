// Every word the MAIN process renders (#336) — the menu bar, the launcher page, the
// dialogs, and the finished sentences the app hands the board UI to print.
//
// The board UI's copy module (`kanban-ui/i18n/`) is a page's, and a menu is not a page:
// this process cannot read it, so it holds a copy module of its own. Same rules, and the
// same English source of truth:
//
// - Extract whole sentences, never grammar. A branch takes its own key holding a whole
//   sentence rather than being stitched together from fragments.
// - A sentence that takes a value is a function, not a template with holes.
// - Product names, file names, paths and shell commands stay English in every language.
// - Punctuation follows the target language: full-width ，。；：？（） in Chinese.
//
// The language is held here rather than passed to every writer: `lib/command.ts` and
// `lib/board-init.ts` are called from deep inside a move and have no language to hand
// down. `main.ts` is the only writer — it holds the answer the machine saved and puts it
// here as it changes.

import en from "./en";
import zh from "./zh";
import type { DesktopCopy } from "./types";

export type { DesktopCopy } from "./types";

const LANGUAGES: Record<string, DesktopCopy> = { en, zh };

/** Every word the main process renders, in one language. A language this build has no
 *  copy for reads English, which is what a build with no Chinese always did. */
export function getCopy(language: string): DesktopCopy {
  return LANGUAGES[language] ?? en;
}

let held = "en";

/** The language every writer below reads. Set by `main.ts` on the launch that reads the
 *  machine's answer, and again on every change. */
export function holdLanguage(next: string): void {
  held = next;
}

export function heldLanguage(): string {
  return held;
}

/** The words in the language this machine is set to. */
export function copy(): DesktopCopy {
  return getCopy(held);
}
