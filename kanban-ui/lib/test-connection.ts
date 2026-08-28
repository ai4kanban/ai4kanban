import { boardRules } from "./cli";
import type { ConnectionTest } from "./types";

// --- the Test button (#168) --------------------------------------------------
// One small chat through the setup that is saved right now, so the user learns the setup
// is broken here rather than on the first card run that fails. It is the CLI's own test —
// the same one `akb agent test` runs — spawned exactly the way a run is, and touching
// nothing: no card, no lock, no place in the run list, no log.

export async function testConnection(runtime?: string): Promise<ConnectionTest> {
  return (await boardRules()).testConnection(runtime);
}
