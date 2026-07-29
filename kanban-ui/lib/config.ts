import fs from "node:fs";
import { uiConfigPath } from "./paths";

// --- the settings the dialog writes ------------------------------------------
// Two settings live in docs/kanban/ui.config.json: `harness` (which agent runs
// every card button — see lib/agent.ts, which owns reading it) and `autoRefine`
// (#41), one top-level boolean, off by default. The Configuration dialog reads
// both on load and writes them as you change them; the skill's auto-refine flows
// (#42, #43) read `autoRefine` before acting.

// Read and parse the whole config object. Throws on a malformed file so a writer
// never clobbers a user's settings; a missing file is an empty object.
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

// Flip the switch and persist it, keeping every other key (the `harness`
// setting) untouched. A file that won't parse fails the save instead of
// overwriting it — losing the user's settings is worse than a failed toggle. A
// missing file is created the first time the switch goes on.
export function setAutoRefine(on: boolean): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    cfg.autoRefine = on;
  });
}

// Save the harness the user picked in the dialog. Writes the name only — a
// `harness.command` override is a hand-edit, and it belongs to the harness it
// was written for, so switching to a different harness drops it rather than
// running one agent's flags under another's name. Re-picking the harness that's
// already set keeps it.
//
// The pre-#68 top-level `command` key is left exactly where it is. Nothing reads
// it, and the dialog says so — but this is the user's file, and quietly deleting
// a line they wrote, as a side effect of clicking an agent, is worse than a
// notice that stays up until they delete it themselves.
export function setHarness(name: string): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const prev = (cfg.harness ?? {}) as { name?: unknown; command?: unknown; model?: unknown };
    const same = prev.name === name;
    const next: Record<string, unknown> = { name };
    if (same && typeof prev.model === "string") next.model = prev.model;
    if (same && typeof prev.command === "string") next.command = prev.command;
    cfg.harness = next;
  });
}

// Save the model id typed in the dialog (#71). Writes `harness.model` and
// nothing else, so the name and a hand-edited `command` survive. An empty field
// means "use the harness's own default" — that drops the key rather than leaving
// an empty string behind, because a missing key and a blank one mean the same
// thing and only one of them reads as deliberate.
//
// The id is never checked here. Model ids change faster than we ship, so the
// harness is the only validator: a bad one makes the run exit non-zero and the
// error text shows in that session's log.
export function setHarnessModel(model: string): { ok: boolean; error?: string } {
  return writeConfig((cfg) => {
    const harness = { ...((cfg.harness ?? {}) as Record<string, unknown>) };
    const id = model.trim();
    if (id) harness.model = id;
    else delete harness.model;
    cfg.harness = harness;
  });
}

// Read the config, apply one change, write it back — the shared body of every
// setter. A file that won't parse fails the save instead of overwriting it.
function writeConfig(change: (cfg: Record<string, unknown>) => void): { ok: boolean; error?: string } {
  const file = uiConfigPath();
  let cfg: Record<string, unknown>;
  try {
    cfg = readConfigRaw();
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't save: ${file} won't parse (${why}). Fix the file, then try again.` };
  }
  change(cfg);
  try {
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${file}: ${why}` };
  }
}
