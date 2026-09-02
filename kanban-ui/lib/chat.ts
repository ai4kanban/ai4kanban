import { getCopy } from "@/i18n";
import { cardStillThere } from "./board";
import { boardRules, whyNoRules } from "./cli";
import { machineCopy } from "./language";
import { DEFAULT_LANGUAGE, type Chat, type ChatTarget } from "./types";

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
// holds no card, and keeps no run off one. It does write the board, though (#243) — the
// agent calls the board's own moves as it answers — which is why a read also carries the
// board's fingerprint and whether the card this conversation is about is still there.

/** One conversation and what the window can do about it right now. */
export interface ChatRead {
  /** The conversation as it stands, or null when nothing has been said yet. */
  chat: Chat | null;
  /** The reply being written this second, as far as it has got — null when none is. */
  live: string | null;
  /** A reply stopped from a window (#267), as far as it got. The turn is over from the
   *  click, but the agent is given a few seconds to shut down before the transcript has it,
   *  so the words are held here across that gap rather than leaving the rail blank. Null
   *  once the transcript has them. */
  stopped: string | null;
  /** A reply is coming, from this window or from a terminal. `live` only knows about one
   *  this window asked for; this knows about any of them. */
  answering: boolean;
  /** When the reply in flight was sent, so the rail can count the seconds up while it is
   *  written. Null when nothing of ours is in flight — a reply a terminal started is
   *  followed, but this server never saw it begin and invents no start for it. */
  liveSince: number | null;
  /** The board as it stood at this read (#243). The window watches it move: a chat writes
   *  the board while it is still writing its reply, so a card that changed has to appear
   *  without anyone clicking anything. Null on rules too old to answer. */
  stamp: string | null;
  /** This is a card's conversation, and that card has left the board — archived or rejected,
   *  quite possibly by this very chat. The card's page goes back to the board on it. */
  cardGone: boolean;
  /** The agent the board runs can hold a conversation at all. */
  canChat: boolean;
  /** That agent's label, for saying which one is meant. */
  agent: string;
  /** The labels of every agent that can hold one — what a refusal names. */
  able: string[];
  /** That agent's own CLI isn't on this machine, so nothing would answer. */
  missing: boolean;
  /** Why the box is shut for good: no agent that can chat, a conversation held with another
   *  one, or rules too old to hold one at all. Not an error, and never a reply in flight —
   *  that one leaves the box open (#268), so the next thought goes into it. */
  blocked?: string;
  /** The last send that never got off the ground, in the agent's own words. Cleared by the
   *  next message. */
  failed?: string;
}

/** The chat a window is showing: the board's, one card's, or the first run's (#280). */
const keyOf = (target: ChatTarget): string =>
  target === null ? "board" : target === "setup" ? "setup" : `card-${target}`;

// Read at load, so English: this is the line for rules too old to hold a conversation,
// and the language is one of the things such a copy may not be able to answer for.
const ENGLISH = getCopy(DEFAULT_LANGUAGE).messages.rules;
const TOO_OLD = `${ENGLISH.tooOldForChat} ${ENGLISH.updateIt}`;

interface Flight {
  /** The reply so far, as the agent writes it. Frozen once stopped, so the words on screen
   *  are the words that were there when the button was pressed. */
  text: string;
  /** When the message was sent. The transcript records the turn's own time when it lands;
   *  this is what the rail counts up from until then. */
  startedAt: number;
  /** End the reply early. Handed over once the agent is actually running, so it is missing
   *  for the gap a first message spends installing the skill. */
  stop?(): void;
  /** Stop was asked for. The turn is over from that moment as far as any window is
   *  concerned; the agent's few seconds to shut down happen behind this. */
  stopped: boolean;
  /** The transcript has this turn. From here the words are the transcript's to draw, so a
   *  stopped reply stops being held — otherwise it would be on screen twice. */
  landed: boolean;
  /** The whole turn, transcript write included — what a message sent during those seconds
   *  waits on rather than being turned away. */
  done: Promise<void>;
}

// Pinned to globalThis for the reason lib/cli.ts pins the rules: Next may evaluate this
// module once per server bundle, and a second copy would be a reply nobody can read.
function flights(): { live: Map<string, Flight>; failed: Map<string, string> } {
  const g = globalThis as unknown as { __kanbanChatFlights?: { live: Map<string, Flight>; failed: Map<string, string> } };
  if (!g.__kanbanChatFlights) g.__kanbanChatFlights = { live: new Map(), failed: new Map() };
  return g.__kanbanChatFlights;
}

const NOTHING: ChatRead = {
  chat: null,
  live: null,
  stopped: null,
  answering: false,
  liveSince: null,
  stamp: null,
  cardGone: false,
  canChat: false,
  agent: "",
  able: [],
  missing: false,
};

/** One conversation as the window draws it. Never throws: a board with no rules to read is
 *  a chat that says so, not a page that fails. */
export async function readChat(cardId: ChatTarget): Promise<ChatRead> {
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
  // A stopped reply is over from the click (#267). The board still holds its marker while
  // the agent shuts down, so `view` still calls the conversation answering — this is where
  // that is corrected, and where the words wait for the transcript.
  const stopping = flight?.stopped ? flight : null;
  const agent = rules.agentInfo();
  return {
    chat: view.chat,
    live: stopping ? null : flight ? flight.text : null,
    stopped: stopping && !stopping.landed ? stopping.text : null,
    // Our own reply in flight, or anyone's — a conversation carried on from a terminal is
    // writing this same board, and the window follows it the same way.
    answering: stopping ? false : Boolean(flight) || view.answering === true,
    liveSince: stopping || !flight ? null : flight.startedAt,
    stamp: rules.boardStamp ? await rules.boardStamp() : null,
    // Asked of the board rather than remembered: the card may have gone at any moment, and
    // a title read is one card file. A card page gives itself up on this, so a miss is
    // confirmed before it counts — see `cardStillThere`.
    cardGone: typeof cardId === "number" && !(await cardStillThere(cardId)),
    canChat: view.canChat,
    agent: view.agent,
    able: view.able,
    missing: agentMissing(agent),
    blocked: stillBlocked(view, agent.options),
    failed: failed.get(keyOf(cardId)),
  };
}

/** Why the box is shut whatever the conversation is doing. "Still answering" is not one of
 *  them — a reply in flight leaves the box open (#268) and a stopped one is over from the
 *  click — but an agent that can't chat at all, or a conversation held with another one,
 *  both outlast either. The board checks those two first, so its own wording is the right
 *  wording for either.
 *
 *  Matched by label: `view.agent` is the agent that answers HERE, which on a board with
 *  runtimes is this computer's binding rather than the board's own name (#343), and it is
 *  that one the board holds a conversation against. */
function stillBlocked(
  view: { canChat: boolean; chat: { harness: string } | null; agent: string; blocked?: string },
  options: { name: string; label: string }[],
): string | undefined {
  if (!view.canChat) return view.blocked;
  const harness = view.chat?.harness;
  if (harness === undefined) return undefined;
  const held = options.find((o) => o.name === harness)?.label ?? harness;
  return held === view.agent ? undefined : view.blocked;
}

/** Send one message, and come straight back. The reply is written into the transcript by
 *  the rules as it arrives; the window reads it through `readChat`. */
export async function sendChat(
  cardId: ChatTarget,
  message: string,
  /** The board is speaking, not the user (#280): the message is sent, and the transcript
   *  keeps only the reply. */
  opts: { fromBoard?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
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
  // A stopped reply is given a few seconds to shut down, and the conversation stays shut
  // until it has. The message waits that out rather than being refused: the turn is over as
  // far as the user is concerned, and "still answering" would read as a lie. Re-read after
  // the wait — whichever of two held messages wakes first takes the conversation, and the
  // other gets the plain no it would have got anyway.
  let held = live.get(key);
  while (held?.stopped) {
    await held.done;
    held = live.get(key);
  }
  if (held) return { ok: false, error: (await machineCopy()).messages.chat.busy };
  failed.delete(key);

  const flight: Flight = { text: "", startedAt: Date.now(), stopped: false, landed: false, done: Promise.resolve() };
  live.set(key, flight);
  // Not awaited: this call returns as soon as the agent has been asked, and the reply lands
  // in the transcript whether or not anyone is still watching. The transcript is written
  // before the promise settles, so clearing the flight afterwards can never show the
  // browser a gap between the live text and the saved message.
  flight.done = send(cardId, message, {
    title: typeof cardId === "number" ? rules.titleOf(cardId) : undefined,
    fromBoard: opts.fromBoard,
    onText: (chunk) => {
      // Frozen on a stop, so the words on screen are the words that were there when the
      // button was pressed.
      if (!flight.stopped) flight.text += chunk;
    },
    // The way to end this reply, once there is one to end. A stop asked for before it
    // arrives is remembered on the flight and spent here.
    onOpen: (stop) => {
      flight.stop = stop;
      if (flight.stopped) stop();
    },
  })
    .then((sent) => {
      // The transcript is on disk by the time this runs, so a stopped reply hands its words
      // over here rather than being drawn beside the message that now holds them.
      flight.landed = true;
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

/** End the reply being written, keeping what arrived (#267). Quiet when there is nothing to
 *  stop: a reply that has already landed, or one a terminal is writing, is left alone.
 *
 *  The flight is this server's, and this server owns every reply a window started on this
 *  board — so a reply started on another page or in another window ends here too. */
export async function stopChat(cardId: ChatTarget): Promise<{ ok: boolean }> {
  const flight = flights().live.get(keyOf(cardId));
  if (!flight) return { ok: true };
  flight.stopped = true;
  // Missing only in the gap before the agent is running; `onOpen` spends it then instead.
  flight.stop?.();
  return { ok: true };
}

/** Forget a conversation and start fresh. A reply still being written is left to finish —
 *  it belongs to the conversation that was cleared, and its own transcript is already gone. */
export async function clearChat(cardId: ChatTarget): Promise<{ ok: boolean; error?: string }> {
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
