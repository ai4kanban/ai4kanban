import fs from "node:fs";
import { modulesPath } from "./paths";

// Read docs/kanban/modules.md — the project's module map, one `- **name** — …`
// line per module — and return just the bolded name at the front of each line.
// That's the only part the create dialog's module picker needs (see #38): the
// name is what the create script's `--modules` flag takes and what a propose
// session focuses on. A missing or empty map reads as no modules — the picker
// just doesn't show. This is the machine-readable source the UI lacked; the file
// stays the single source of truth.
export function readModules(): string[] {
  let text: string;
  try {
    text = fs.readFileSync(modulesPath(), "utf8");
  } catch {
    return []; // no map yet — nothing to pick from
  }
  const names: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s+\*\*(.+?)\*\*/);
    if (m) names.push(m[1].trim());
  }
  return names;
}
