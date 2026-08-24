import { boardRules } from "./cli";
import type { FlowRuleView, WriteResult } from "./types";

// --- the flow rules (#306) ---------------------------------------------------
// One rule per flow, in the user's own words, appended to the end of that flow's built-in
// prompt. The Rules section in the Configuration dialog reads and writes them.
//
// Nothing here knows which flows exist, what each one is, or where a rule is stored. That
// is the board's own list — every command that can start a flow — so a flow shipped later
// takes a rule with nothing in this app touched.

/** Every flow this board has, with the rule it carries. Rules older than the release that
 *  added flow rules answer nothing at all, and the section says so rather than drawing an
 *  empty list. */
export async function flowRules(): Promise<FlowRuleView[] | null> {
  const rules = await boardRules();
  return rules.readFlowRules ? rules.readFlowRules() : null;
}

/** Save one flow's rule, or clear it with empty text. Saved with the board so a team shares
 *  it — and so a run started from a terminal reads the same words. */
export async function setFlowRule(command: string, text: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setFlowRule) {
    return { ok: false, error: "the board's rules in this project are too old to save a flow rule" };
  }
  return rules.setFlowRule(command, text);
}
