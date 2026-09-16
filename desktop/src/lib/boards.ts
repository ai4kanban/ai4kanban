// Which boards a project holds, read by the MAIN process (#495).
//
// The window title has to name the board, and a board folder is called `kanban` on every
// board there is — so the name has to come from what the board's work IS. That answer
// belongs to the rules, which the app already carries (the same file it hands each board
// server as `AI4KANBAN_CLI`), so this asks them rather than reading `config.md` itself.
//
// Best effort, like ./rules.ts: a build with no bundled rules, or a copy older than the
// second board, leaves the title the project's name alone.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bundledResource } from "./resources";

/** One board a project holds — the rules' own `listBoards` entry. */
interface BoardEntry {
  path: string;
  /** The board folder from the project root — `docs/kanban`. */
  name: string;
}

interface BoardRules {
  listBoards?(root: string): BoardEntry[];
}

// The rules are ESM and this process is CommonJS, so a plain `import()` would be compiled
// down to a `require()` that cannot load them (the same trick as ./rules.ts).
const importEsm = new Function("url", "return import(url)") as (url: string) => Promise<BoardRules>;

let loaded: Promise<BoardRules> | null = null;

function rules(): Promise<BoardRules> {
  if (!loaded) {
    const file = bundledResource("cli", "dist", "kanban.mjs");
    loaded = fs.existsSync(file) ? importEsm(pathToFileURL(file).href).catch(() => ({})) : Promise.resolve({});
  }
  return loaded;
}

/** Every board under `project`. Empty when the rules cannot say. */
export async function listBoards(project: string): Promise<BoardEntry[]> {
  try {
    return (await rules()).listBoards?.(project) ?? [];
  } catch {
    return [];
  }
}

/** Which board of this project the window at `board` is on — its folder from the project
 *  root, and only where the project holds more than one (#718). Null otherwise: with one
 *  board the project's own name is the whole title, and every board folder is called
 *  `kanban`, so the folder alone would say nothing.
 *
 *  `board` is what the window was opened on, which is a PROJECT when the board is that
 *  project's own `docs/kanban` and the board folder itself otherwise — so both spellings
 *  are looked for. */
export async function boardWord(project: string, board: string): Promise<string | null> {
  const boards = await listBoards(project);
  if (boards.length < 2) return null;
  const standard = path.join(board, "docs", "kanban");
  const found = boards.find((b) => b.path === board) ?? boards.find((b) => b.path === standard);
  return found?.name ?? null;
}
