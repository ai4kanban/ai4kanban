import { boardRules } from "./cli";
import type { ChatTarget, ConversationRow, DiscussionRow, DiscussionTarget } from "./types";

// --- the discussions a board is holding (#496) --------------------------------
//
// The list itself is the command's (cli/src/lib/agent/discussions.ts): the `chats/` files,
// the 20 spoken to most recently, and the one that fell past them. This is the board's door
// onto it, so the rail, the Create sheet and `akb chat` all read one list.
//
// Never throws. A board whose rules are older than discussions draws no list and holds its
// one conversation, which is what such a board really has.

export async function listDiscussions(): Promise<DiscussionRow[]> {
  try {
    return (await boardRules()).listDiscussions?.() ?? [];
  } catch {
    return [];
  }
}

/** Every conversation the rail lists (#633): the discussions, and one row per open card with
 *  a chat going. Rules from before card chats joined the list answer with the discussions
 *  alone, which is every conversation such a board can hold a row for. */
export async function listConversations(): Promise<ConversationRow[]> {
  try {
    const rules = await boardRules();
    return rules.listConversations?.() ?? rules.listDiscussions?.() ?? [];
  } catch {
    return [];
  }
}

/** Open a discussion. Nothing is written until the first message, so a press that opens the
 *  sheet and closes it again leaves no row behind. Null on rules too old to hold one. */
export async function startDiscussion(): Promise<DiscussionTarget | null> {
  try {
    return (await boardRules()).startDiscussion?.() ?? null;
  } catch {
    return null;
  }
}

/** Take one conversation out of the list — a discussion, or a card's own chat (#633). Its
 *  transcript stays on this machine, and a card's card page still draws it. */
export async function archiveDiscussion(target: ChatTarget): Promise<{ ok: boolean; error?: string }> {
  try {
    const done = (await boardRules()).archiveDiscussion?.(target);
    if (!done) return { ok: false };
    return "error" in done ? { ok: false, error: done.error } : { ok: true };
  } catch {
    return { ok: false };
  }
}

/** The discussion a string names, checked by the board rather than by this file — so nothing
 *  a browser sends can name a conversation this board did not write. */
export async function asDiscussion(named: string): Promise<DiscussionTarget | null> {
  if (typeof named !== "string" || !named) return null;
  try {
    return (await boardRules()).asDiscussion?.(named) ?? null;
  } catch {
    return null;
  }
}
