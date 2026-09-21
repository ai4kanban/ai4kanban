import { machineCopy, said } from "./language";
import { boardRules } from "./cli";
import type { WorkflowStage, WorkflowView, WriteResult } from "./types";

// --- the workflows a card runs through (#715) --------------------------------
// Every card goes through one workflow: `plan → execute → review`, each stage led by one
// agent and able to call in helpers. This is the boundary between the pane and whatever
// `akb` the project has — the board owns every check, so the pane and `akb workflow` refuse
// the same moves and neither has a copy of the rules.
//
// A project on rules older than workflows answers nothing at all, and the pane says so
// rather than drawing a list it cannot save from.

const tooOld = async (): Promise<string> => (await machineCopy()).messages.tooOld.agents;

/** Every workflow this board has, with each stage's lead, helpers and candidates. `null` on
 *  rules older than the pane. */
export async function workflows(): Promise<WorkflowView[] | null> {
  const rules = await boardRules();
  if (!rules.workflowViews) return null;
  return rules.workflowViews();
}

/** Whether this board picks workflows at all. False on a board whose rules are too old, so
 *  the section is hidden rather than drawn empty. */
export async function workflowsOffered(): Promise<boolean> {
  const rules = await boardRules();
  return !!rules.workflowViews;
}

/** Add a workflow of this board's own, with all three stages empty. */
export async function createWorkflow(name: string): Promise<WriteResult & { id?: string; name?: string }> {
  const rules = await boardRules();
  if (!rules.createWorkflow) return { ok: false, error: await tooOld() };
  return said(await rules.createWorkflow(name));
}

/** Copy one whole, assignments and extra requirements and all. `called` is what the screen
 *  the copy was asked for calls it — a built-in's name is the English the command ships, and
 *  the copy takes the reader's own words for it. */
export async function duplicateWorkflow(
  id: string,
  called?: string,
): Promise<WriteResult & { id?: string; name?: string }> {
  const rules = await boardRules();
  if (!rules.duplicateWorkflow) return { ok: false, error: await tooOld() };
  return said(await rules.duplicateWorkflow(id, called));
}

/** Rename one this board added. Its id does not move, so every card on it is unmoved. */
export async function renameWorkflow(id: string, name: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.renameWorkflow) return { ok: false, error: await tooOld() };
  return said(await rules.renameWorkflow(id, name));
}

/** Turn **Use a Git worktree** on or off for one this board added (#874). */
export async function setWorkflowWorktree(id: string, on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setWorkflowWorktree) return { ok: false, error: await tooOld() };
  return said(await rules.setWorkflowWorktree(id, on));
}

/** Take the "an assignment was removed" mark off one workflow (#945). The assignment is
 *  already gone; this only stops the pane saying so. */
export async function dismissRetiredAssignment(id: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.dismissRetiredAssignment) return { ok: false, error: await tooOld() };
  return said(await rules.dismissRetiredAssignment(id));
}

/** Drop one this board added, once no open card still runs on it. */
export async function deleteWorkflow(id: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.deleteWorkflow) return { ok: false, error: await tooOld() };
  return said(await rules.deleteWorkflow(id));
}

/** The open cards still running on one workflow — what a delete is refused over. */
export async function cardsOnWorkflow(id: string): Promise<number[]> {
  const rules = await boardRules();
  return rules.cardsOnWorkflow ? rules.cardsOnWorkflow(id) : [];
}

/** The one agent that runs a stage, or empty to leave it with nobody. */
export async function setWorkflowLead(id: string, stage: WorkflowStage, agent: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setWorkflowLead) return { ok: false, error: await tooOld() };
  return said(await rules.setWorkflowLead(id, stage, agent));
}

/** Let a stage's lead call one more agent in. */
export async function addWorkflowHelper(id: string, stage: WorkflowStage, agent: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.addWorkflowHelper) return { ok: false, error: await tooOld() };
  return said(await rules.addWorkflowHelper(id, stage, agent));
}

/** End one helper's assignment to a stage. The agent itself is untouched. */
export async function removeWorkflowHelper(id: string, stage: WorkflowStage, agent: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.removeWorkflowHelper) return { ok: false, error: await tooOld() };
  return said(await rules.removeWorkflowHelper(id, stage, agent));
}

/** What THIS assignment asks of a helper, on top of its own instructions. */
export async function setWorkflowHelperExtra(
  id: string,
  stage: WorkflowStage,
  agent: string,
  extra: string,
): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setWorkflowHelperExtra) return { ok: false, error: await tooOld() };
  return said(await rules.setWorkflowHelperExtra(id, stage, agent, extra));
}
