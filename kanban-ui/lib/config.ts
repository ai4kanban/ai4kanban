import fs from "node:fs";
import { uiConfigPath } from "./paths";

// --- the auto-refine switch --------------------------------------------------
// The global auto-refine setting lives in the same docs/kanban/ui.config.json
// the UI already reads for the agent `command` (#41). It's one top-level boolean,
// `autoRefine`, off by default. The Configuration dialog reads it on load and
// writes it when you flip the switch; the skill's auto-refine flows (#42, #43)
// read the same key before acting.

// Stamped onto a freshly created ui.config.json so a hand-opened file still
// explains itself. Kept in sync with the checked-in docs/kanban/ui.config.json.
const CONFIG_NOTE =
  "Configures the board UI (ai4kanban-ui) and carries the auto-refine switch. " +
  "`command` is the agent connector spawned by every card button (default `claude -p`). " +
  "`autoRefine` (boolean, default off) is the global auto-refine switch you flip from the " +
  "UI's Configuration dialog: when on, the agent refines cards and answers its own safe " +
  "questions without asking you.";

// Read and parse the whole config object. Throws on a malformed file so a writer
// never clobbers a user's `command`; a missing file is an empty object.
function readConfigRaw(): Record<string, unknown> {
  const file = uiConfigPath();
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Auto-refine on/off, read for the Configuration dialog. Off by default: a
// missing file, a missing key, or a file that won't parse all count as off, and
// the read never throws — a broken file still renders the board. The write path
// is where a parse error surfaces (setAutoRefine below), so it can't quietly
// overwrite the user's `command`.
export function readAutoRefine(): boolean {
  try {
    return readConfigRaw().autoRefine === true;
  } catch {
    return false;
  }
}

// Flip the switch and persist it, keeping every other key (the agent `command`,
// the `//` note) untouched. A file that won't parse fails the save instead of
// overwriting it — losing the user's `command` is worse than a failed toggle. A
// missing file is created the first time the switch goes on, seeded with the note.
export function setAutoRefine(on: boolean): { ok: boolean; error?: string } {
  const file = uiConfigPath();
  let cfg: Record<string, unknown>;
  try {
    cfg = readConfigRaw();
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't save: ${file} won't parse (${why}). Fix the file, then try again.` };
  }
  if (cfg["//"] === undefined) cfg["//"] = CONFIG_NOTE;
  cfg.autoRefine = on;
  try {
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${file}: ${why}` };
  }
}
