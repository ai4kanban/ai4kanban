import fs from "node:fs";
import { envFilePath, kanbanGitignorePath } from "./paths";

// --- docs/kanban/.env: the board's one place for keys (#94) ------------------
// Every key the board uses lives here and nowhere else — never in
// ui.config.json, never in a shell profile the dialog can't see. The file is
// plain `NAME=value` lines, one per line, because it is hand-edited as often as
// it is written: you type a key into the Configuration dialog and it lands
// here, or you write the line yourself, and both read back the same.
//
// The board reads this file for WHICH keys it holds, never for what to show. A
// saved key is never read back into the browser — the dialog says set or not
// set — so a hand-written key reads as set and works in the next run, with no
// restart and no second place to keep it in step.
//
// Which variable a key reaches a run under is the harness setting's business
// (lib/agent.ts): a secret setting names its variable, and a run gets that one
// set from this file. A variable this file doesn't name is left exactly as the
// server got it.

// A line that sets a variable, or null for a blank line, a comment, or anything
// that isn't `NAME=value`. A value wrapped in quotes is read without them — the
// file is hand-edited, so it reads the way people write one. Anything else is
// kept verbatim, spaces and all: a key can hold characters we have no business
// guessing at.
function parseLine(line: string): { name: string; value: string } | null {
  const text = line.trim();
  if (!text || text.startsWith("#")) return null;
  const eq = text.indexOf("=");
  if (eq <= 0) return null;
  const name = text.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  return { name, value: unquote(text.slice(eq + 1).trim()) };
}

function unquote(value: string): string {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
}

/** Every variable the file sets, by name. A missing or unreadable file holds
 *  nothing — a board with no keys is the normal case, not a failure. A line
 *  with an empty value is left out: an empty key and a missing one mean the
 *  same thing, and only one of them reads as deliberate. */
export function readEnvFile(): Record<string, string> {
  let text: string;
  try {
    text = fs.readFileSync(envFilePath(), "utf8");
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const pair = parseLine(line);
    if (pair && pair.value) values[pair.name] = pair.value;
  }
  return values;
}

/** The variables from this list the file actually holds, ready to overlay onto
 *  a run's environment. What is in `.env` wins, so what the dialog shows is
 *  what the run gets; a name the file doesn't carry is absent here and the run
 *  inherits whatever the server was started with. */
export function secretEnv(names: string[]): Record<string, string> {
  const file = readEnvFile();
  const env: Record<string, string> = {};
  for (const name of names) {
    if (file[name]) env[name] = file[name];
  }
  return env;
}

// What the board writes into docs/kanban/.gitignore, so a fresh board is safe
// without the user editing anything. It goes in the board's OWN ignore file,
// never the repo's root one: that file is the user's, and a board that edits it
// is a board that surprises them.
const IGNORE_BLOCK = "# The board's API keys — never commit them.\n.env\n";

// Make sure `.env` can't be committed, and say so if it can't be arranged. A
// file already there gets the line added, not replaced — comments, order and
// every other rule in it are the user's.
//
// This runs BEFORE a key is written, and a failure refuses the save: writing a
// key we can't keep out of git is worse than not saving it.
function ensureIgnored(): { ok: boolean; error?: string } {
  const file = kanbanGitignorePath();
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, IGNORE_BLOCK);
      return { ok: true };
    }
    const text = fs.readFileSync(file, "utf8");
    if (text.split("\n").some((line) => line.trim() === ".env")) return { ok: true };
    const separator = !text || text.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(file, `${text}${separator}${IGNORE_BLOCK}`);
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${file} to keep the key out of git: ${why}` };
  }
}

/** True when the file holds this variable with a value — the whole of what the
 *  dialog is told about a saved key. */
export function isSecretSet(name: string): boolean {
  return Boolean(readEnvFile()[name]);
}

// Save one key, or clear it when the value is empty. Rewrites that one line and
// leaves every other line alone — a key the board doesn't know, a comment, the
// order they sit in. The file is the user's as much as the dialog's, so the
// dialog can't be the reason a line goes missing.
//
// The file is created 0600 (owner only): it holds keys, and on a shared machine
// the default would let anyone else on it read them.
export function setSecret(name: string, value: string): { ok: boolean; error?: string } {
  const ignored = ensureIgnored();
  if (!ignored.ok) return ignored;

  const file = envFilePath();
  let lines: string[];
  try {
    lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't read ${file}: ${why}` };
  }

  const next = value.trim();
  const kept: string[] = [];
  let written = false;
  for (const line of lines) {
    const pair = parseLine(line);
    if (!pair || pair.name !== name) {
      kept.push(line);
      continue;
    }
    if (!next || written) continue; // cleared, or a duplicate of the line we just rewrote
    kept.push(`${name}=${next}`);
    written = true;
  }
  let text = kept.join("\n");
  if (text && !text.endsWith("\n")) text += "\n";
  if (next && !written) text += `${name}=${next}\n`;

  try {
    fs.writeFileSync(file, text, { mode: 0o600 });
    return { ok: true };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `couldn't write ${file}: ${why}` };
  }
}
