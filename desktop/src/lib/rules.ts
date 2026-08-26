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
  isLanguage?(value: unknown): boolean;
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
