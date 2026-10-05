// Where the test cases are for the board on screen (#1422): `docs/qa/` at the project root.

import fs from "node:fs";
import path from "node:path";
import { modulesPath, repoRoot } from "./paths";

export const qaRoot = (): string => path.join(repoRoot(), "docs", "qa");

/** Where the cases' screenshots and logs are: kept out of git (#1550). */
export const evidenceRoot = (): string => path.join(repoRoot(), ".akb", "qa");

/** The module names in the board's module map, in its order. */
export function moduleOrder(): string[] {
  try {
    return [...fs.readFileSync(modulesPath(), "utf8").matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1]!.trim());
  } catch {
    return [];
  }
}
