import { boardRules, whyNoRules } from "./cli";
import { clearChat, readChat, sendChat } from "./chat";
import type { SetupProposal } from "./types";

// --- the board's first-run conversation (#280) --------------------------------
//
// The first run asks what the project is by talking rather than by handing over a form. The
// conversation itself is the chat the board already holds with its agent (lib/chat.ts) —
// one resumed session, the reply streamed — under a target of its own, so the first run and
// the board's own chat can never read each other's.
//
// Two things are different from the rail's chat, and both are why this file exists:
//
//   • The board speaks first. The opening turn is the board's own words, sent with
//     `fromBoard` so no transcript ever shows it as something the user typed.
//   • The reply is read, not shown. The agent answers in one JSON block; the board turns it
//     into the two config answers the project view draws, and writes them only when the user
//     presses Yes. A reply that block can't be read out of is a turn that failed.

/** The first run's conversation as the view draws it. */
export interface SetupChatRead {
  /** The rules this board runs can hold the conversation at all. False on a copy older than
   *  the release that added it, and on an agent that can't resume a session — the first run
   *  then falls back to the screens it always had. */
  supported: boolean;
  /** A turn has been sent and nothing has come back yet — the waiting view. */
  answering: boolean;
  /** Anything at all has been said. False before the opening turn is sent. */
  started: boolean;
  /** What the last reply came back with, or null when there is none to draw. */
  proposal: SetupProposal | null;
  /** The last turn went wrong: what the agent said, verbatim, for the view to show as it
   *  came. Null while the conversation is going normally. */
  failed: string | null;
}

const NOTHING: SetupChatRead = {
  supported: false,
  answering: false,
  started: false,
  proposal: null,
  failed: null,
};

/** One read of the conversation. Never throws: the first run's answer to a board it can't
 *  read is the form, not a screen that fails. */
export async function readSetupChat(): Promise<SetupChatRead> {
  let rules;
  try {
    rules = await boardRules();
  } catch {
    return NOTHING;
  }
  if (!rules.setupOpening || !rules.parseSetupProposal || !rules.sendChatMessage) return NOTHING;
  const read = await readChat("setup");
  // An agent that can't hold a conversation is not a failed turn — there is nothing to
  // fail. The form is the answer, and the flow offers it.
  if (!read.canChat || read.missing) return NOTHING;

  const messages = read.chat?.messages ?? [];
  const started = messages.length > 0 || read.answering || Boolean(read.live);
  if (read.answering) return { supported: true, answering: true, started, proposal: null, failed: null };

  // The send that never got off the ground, then the last turn as the transcript kept it.
  if (read.failed) return { supported: true, answering: false, started, proposal: null, failed: read.failed };
  const last = [...messages].reverse().find((m) => m.role === "agent");
  if (!last) return { supported: true, answering: false, started, proposal: null, failed: null };
  if (last.stoppedWhy) {
    // What the agent said before it stopped, then why it stopped — the view shows both,
    // verbatim, because the words are usually the reason and the code never is.
    const said = [last.text.trim(), last.stoppedWhy].filter(Boolean).join("\n");
    return { supported: true, answering: false, started, proposal: null, failed: said };
  }
  const proposal = rules.parseSetupProposal(last.text);
  // A reply with no block to read is a turn that failed, shown as it came: the board never
  // guesses a project out of prose it was not given.
  return {
    supported: true,
    answering: false,
    started,
    proposal,
    failed: proposal ? null : last.text.trim() || null,
  };
}

/** Open the conversation, or start it over. Whatever was said before is dropped — a turn
 *  that went wrong is retried from the top rather than argued with, and the agent's own
 *  session is left where it lies. */
export async function openSetupChat(): Promise<{ ok: boolean; error?: string }> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ok: false, error: whyNoRules(e) };
  }
  if (!rules.setupOpening) return { ok: false, error: "this board's rules are too old to hold the first-run conversation." };
  await clearChat("setup");
  return sendChat("setup", rules.setupOpening(), { fromBoard: true });
}

/** One correction from the user, into the conversation already open. */
export async function saySetupChat(text: string): Promise<{ ok: boolean; error?: string }> {
  return sendChat("setup", text);
}
