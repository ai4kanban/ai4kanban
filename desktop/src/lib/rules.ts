// The board's rules, read by the MAIN process (#334).
//
// The app already carries one copy — the file it hands each board server as
// `AI4KANBAN_CLI` — and this is that same file. The menu lives outside the page, so it
// needs the language before the board has finished loading; waiting for the page to report
// would leave an English menu bar up for as long as the board takes, on every launch.
//
// Best effort, loaded once: a build with no bundled rules, or a copy older than the
// setting, reads as English rather than holding the window up over a preference.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { bundledResource } from "./resources";

/** The little of the rules' surface this process asks for. */
interface Rules {
  readLanguage?(): string;
  languageChosen?(): boolean;
  setLanguage?(value: string): { ok: boolean };
  isLanguage?(value: unknown): boolean;
  languageForTag?(tag: string): string | null;
  LANGUAGES?: readonly string[];
  LANGUAGE_NAMES?: Record<string, string>;
  LANGUAGE_TAGS?: Record<string, string>;
  reportAppOpen?(surface?: string): void;
}

// The rules are ESM and this process is CommonJS, so a plain `import()` would be compiled
// down to a `require()` that cannot load them. Hiding it from the compiler keeps it one.
const importEsm = new Function("url", "return import(url)") as (url: string) => Promise<Rules>;

let loaded: Promise<Rules> | null = null;

function rules(): Promise<Rules> {
  if (!loaded) {
    const file = bundledResource("cli", "dist", "kanban.mjs");
    loaded = fs.existsSync(file) ? importEsm(pathToFileURL(file).href).catch(() => ({})) : Promise.resolve({});
  }
  return loaded;
}

/** What a machine that has never said reads as, and what every failure above falls back to. */
export const DEFAULT_LANGUAGE = "en";

/** The language this machine reads in — one answer, shared with the board UI and with an
 *  `akb` in a terminal. */
export async function machineLanguage(): Promise<string> {
  const held = (await rules()).readLanguage?.();
  return held || DEFAULT_LANGUAGE;
}

/** Whether the page named a language this build knows. Asked of the command's own list, so
 *  the app keeps no second copy of it. */
export async function knownLanguage(value: unknown): Promise<boolean> {
  const mod = await rules();
  return mod.isLanguage ? mod.isLanguage(value) : value === DEFAULT_LANGUAGE;
}

/** Save the language this machine reads in (#339). The board saves through its own board
 *  server; the launcher is a `data:` page with none behind it, so its switcher comes here. */
export async function saveLanguage(value: string): Promise<void> {
  (await rules()).setLanguage?.(value);
}

/** Open in the machine's own language on the launch that finds nothing saved (#339).
 *
 *  `preferred` is the reader's languages in the order they asked for them
 *  (`app.getPreferredSystemLanguages()`); the first this build has a copy for is written
 *  down, and every surface reads it from the file afterwards. Nothing is guessed once an
 *  answer is saved — including an explicit English one — and nothing is guessed by a build
 *  whose bundled rules predate the setting.
 *
 *  A guess that cannot be saved is not made: a home directory the app cannot write opens
 *  English and the next launch guesses again, rather than leaving the menu and the board
 *  reading two different answers. */
export async function guessLanguage(preferred: readonly string[]): Promise<void> {
  const mod = await rules();
  if (!mod.languageChosen || !mod.languageForTag || mod.languageChosen()) return;
  for (const tag of preferred) {
    const guess = typeof tag === "string" ? mod.languageForTag(tag) : null;
    if (guess) {
      mod.setLanguage?.(guess);
      return;
    }
  }
}

/** One language a switcher offers: its code, its own name for itself, and the BCP 47 tag a
 *  page carries for it. Empty when the bundled rules predate the setting — then the launcher
 *  draws no switcher, since a control that cannot save is worse than no control. */
export interface LanguageChoice {
  code: string;
  name: string;
  tag: string;
}

export async function languageChoices(): Promise<LanguageChoice[]> {
  const mod = await rules();
  if (!mod.LANGUAGES || !mod.LANGUAGE_NAMES || !mod.LANGUAGE_TAGS || !mod.setLanguage) return [];
  const names = mod.LANGUAGE_NAMES;
  const tags = mod.LANGUAGE_TAGS;
  return mod.LANGUAGES.map((code) => ({ code, name: names[code] ?? code, tag: tags[code] ?? code }));
}

/** The app was opened (#295) — one of the four numbers #292 exists to answer, and the one
 *  thing only this process witnesses. Every other counted action happens inside the board
 *  server, where the rules count it themselves.
 *
 *  The surface is said rather than sniffed: the rules read `KANBAN_DESKTOP`, which this
 *  process sets on the SERVERS it starts and not on itself.
 *
 *  Optional and silent, like every read above. It reports nothing on a machine that turned
 *  reporting off, and nothing at all until the disclosure step has been answered — so the
 *  first launch of all is counted by the step's own Continue (kanban-ui/components/Privacy).
 */
export async function reportAppOpen(): Promise<void> {
  (await rules()).reportAppOpen?.("app");
}
