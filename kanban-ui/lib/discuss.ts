import { boardRules } from "./cli";
import type { DiscussRead, PlanAnswer } from "./types";

// --- Discuss (#427) -----------------------------------------------------------
//
// The Discuss screen is the board's own conversation (lib/chat.ts) with one thing added: the
// plan file the discussion is talking into shape. This is the board's door onto that — the
// plan, the ask standing under the last message, and the run one of its answers handed the
// plan to — all of it held by the rules, beside the transcript, so a discussion survives the
// window being closed.
//
// Nothing here writes the plan file. The agent does, in the conversation; the board only
// ever reads it.

/** The flow every Discuss message runs (`akb guide discuss-idea`). It rides in front of the
 *  words on every turn, not only the first: the session drifts away from a flow it was told
 *  once, and a reply typed in the chat rail carries none at all. */
export const DISCUSS_GUIDE = "discuss-idea";

/** A board whose rules are older than Discuss, or one with no plan in flight. Both draw the
 *  same screen: the conversation, and no panel. */
const NOTHING: DiscussRead = { plan: null, ask: false, run: null };

/** The plan the board's conversation is writing, as the screen draws it. Never throws: a
 *  board that cannot answer is a screen with no panel, not a page that fails. */
export async function readDiscuss(): Promise<DiscussRead> {
  try {
    const rules = await boardRules();
    return (await rules.readDiscuss?.()) ?? NOTHING;
  } catch {
    return NOTHING;
  }
}

/** Whether this board's rules can hold a discussion at all — what puts Discuss in the mode
 *  row, and what leaves the create screen opening on Add task when they can't. */
export async function canDiscuss(): Promise<boolean> {
  try {
    const rules = await boardRules();
    return typeof rules.readDiscuss === "function" && typeof rules.sendChatMessage === "function";
  } catch {
    return false;
  }
}

/** The user pressed one of the three answers. It is written into the transcript as something
 *  they said — the board acts on it, so asking the agent to reply as well would be a turn
 *  spent saying nothing. */
export async function noteAnswer(text: string): Promise<void> {
  try {
    (await boardRules()).noteChatMessage?.(null, text);
  } catch {
    // The answer is still acted on; only the line in the transcript is lost.
  }
}

/** The run this plan was handed to has started, and which answer handed it over (#481). */
export async function planningStarted(sessionId: string, answer: PlanAnswer): Promise<void> {
  try {
    (await boardRules()).startedPlanning?.(sessionId, answer);
  } catch {
    // Unrecorded, so reopening Discuss offers the run again rather than saying it is going.
  }
}

/** The plan path a run is pointed at — as the project spells it, which is how the read
 *  already carries it. Null when the conversation is writing none. */
export async function planToPlanFrom(): Promise<string | null> {
  return (await readDiscuss()).plan?.path ?? null;
}
