import { boardRules, whyNoRules } from "./cli";
import type { Chat } from "./types";

// --- the conversation, through the CLI (#242) --------------------------------
// The chat itself is the command's (cli/src/lib/agent/chat.ts): the transcript file, the
// session the agent carries the conversation on by, and the one-message-at-a-time rule are
// all there. This is the board's door onto it, so a chat in the window and `akb chat` in a
// terminal are one conversation.
//
// What this file adds is the one thing a terminal doesn't need: a reply outlives the click
// that asked for it. The browser can't hold a stream open — folding the rail, or walking to
// another card, would cut it — so the reply is owned here, on the server, and the browser
// reads how far it has got. That is also why a reply keeps arriving while the rail is
// folded, and why closing the tab doesn't stop one.
//
// A chat is never a run: nothing here reaches the run record, so it shows in no panel,
// holds no card, and keeps no run off one.

/** One conversation and what the window can do about it right now. */
export interface ChatRead {
  /** The conversation as it stands, or null when nothing has been said yet. */
  chat: Chat | null;
  /** The reply being written this second, as far as it has got — null when none is. */
  live: string | null;
  /** The agent the board runs can hold a conversation at all. */
  canChat: boolean;
  /** That agent's label, for saying which one is meant. */
  agent: string;
  /** The labels of every agent that can hold one — what a refusal names. */
  able: string[];
  /** That agent's own CLI isn't on this machine, so nothing would answer. */
  missing: boolean;
  /** Why nothing can be sent this second: no agent that can chat, a conversation held with
   *  another one, or a reply still coming. Not an error — the box is simply shut. */
  blocked?: string;
  /** The last send that never got off the ground, in the agent's own words. Cleared by the
   *  next message. */
  failed?: string;
}

/** The chat a window is showing: the board's, or one card's. */
const keyOf = (cardId: number | null): string => (cardId === null ? "board" : `card-${cardId}`);

const TOO_OLD =
  "This board's copy of the board's rules is too old to hold a conversation. Run `npm install -g ai4kanban` to update it.";

interface Flight {
  /** The reply so far, as the agent writes it. */
  text: string;
}

// Pinned to globalThis for the reason lib/cli.ts pins the rules: Next may evaluate this
// module once per server bundle, and a second copy would be a reply nobody can read.
function flights(): { live: Map<string, Flight>; failed: Map<string, string> } {
  const g = globalThis as unknown as { __kanbanChatFlights?: { live: Map<string, Flight>; failed: Map<string, string> } };
  if (!g.__kanbanChatFlights) g.__kanbanChatFlights = { live: new Map(), failed: new Map() };
  return g.__kanbanChatFlights;
}

const NOTHING: ChatRead = { chat: null, live: null, canChat: false, agent: "", able: [], missing: false };

/** One conversation as the window draws it. Never throws: a board with no rules to read is
 *  a chat that says so, not a page that fails. */
export async function readChat(cardId: number | null): Promise<ChatRead> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ...NOTHING, blocked: whyNoRules(e) };
  }
  if (!rules.readChatView) return { ...NOTHING, blocked: TOO_OLD };
  const view = rules.readChatView(cardId);
  const { live, failed } = flights();
  const flight = live.get(keyOf(cardId));
  return {
    chat: view.chat,
    live: flight ? flight.text : null,
    canChat: view.canChat,
    agent: view.agent,
    able: view.able,
    missing: agentMissing(rules.agentInfo()),
    blocked: view.blocked,
    failed: failed.get(keyOf(cardId)),
  };
}

/** Send one message, and come straight back. The reply is written into the transcript by
 *  the rules as it arrives; the window reads it through `readChat`. */
export async function sendChat(cardId: number | null, message: string): Promise<{ ok: boolean; error?: string }> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ok: false, error: whyNoRules(e) };
  }
  const send = rules.sendChatMessage;
  if (!send) return { ok: false, error: TOO_OLD };

  const key = keyOf(cardId);
  const { live, failed } = flights();
  if (live.has(key)) return { ok: false, error: "this conversation is still answering the last message." };
  failed.delete(key);

  const flight: Flight = { text: "" };
  live.set(key, flight);
  // Not awaited: this call returns as soon as the agent has been asked, and the reply lands
  // in the transcript whether or not anyone is still watching. The transcript is written
  // before the promise settles, so clearing the flight afterwards can never show the
  // browser a gap between the live text and the saved message.
  void send(cardId, message, {
    title: cardId === null ? undefined : rules.titleOf(cardId),
    onText: (chunk) => {
      flight.text += chunk;
    },
  })
    .then((sent) => {
      if ("error" in sent) failed.set(key, sent.error);
    })
    .catch((e: unknown) => {
      failed.set(key, e instanceof Error ? e.message : String(e));
    })
    .finally(() => {
      live.delete(key);
    });
  return { ok: true };
}

/** Forget a conversation and start fresh. A reply still being written is left to finish —
 *  it belongs to the conversation that was cleared, and its own transcript is already gone. */
export async function clearChat(cardId: number | null): Promise<{ ok: boolean; error?: string }> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ok: false, error: whyNoRules(e) };
  }
  if (!rules.clearChat) return { ok: false, error: TOO_OLD };
  flights().failed.delete(keyOf(cardId));
  rules.clearChat(cardId);
  return { ok: true };
}

/** The picked agent's own CLI is not on this machine, so a message would die at the spawn.
 *  `=== false` on purpose: rules too old to answer this leave it unsaid rather than
 *  claiming the agent is missing. */
function agentMissing(info: { name: string; options: { name: string; installed?: boolean }[] }): boolean {
  return info.options.find((o) => o.name === info.name)?.installed === false;
}
