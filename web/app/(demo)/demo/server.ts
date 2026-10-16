// What kanban-ui's server actions (./stand-ins.cjs) and polls (./poll.ts) answer on /demo.
// The New idea sheet polls its own discussion, so that read says "a fresh one, ready to send";
// everything else never settles, which leaves the screen exactly as it was drawn.
import type { ChatMessage } from "ai4kanban-ui/lib/types";
import type { ChatRead } from "ai4kanban-ui/lib/chat";

export const AGENT = "Claude Code";

export function chatRead(messages: ChatMessage[], answering = false): ChatRead {
  return {
    chat: messages.length ? { cardId: null, harness: "claude", messages, startedAt: messages[0].at, updatedAt: messages.at(-1)!.at } : null,
    live: null,
    stopped: null,
    answering,
    background: 0,
    liveSince: null,
    stamp: null,
    cardGone: false,
    canChat: true,
    agent: AGENT,
    able: [AGENT],
    seesImages: true,
    imagesAble: [AGENT],
    missing: false,
    pick: null,
  };
}

const POLLS: Record<string, () => unknown> = {
  "/poll/chat": () => chatRead([]),
  "/poll/discuss": () => ({ plan: null, plans: [], run: null, rows: [], supported: true }),
};

/** Never settles: an answer the screen would act on is one the demo does not have. */
export const pending = () => new Promise<never>(() => {});

export const answer = pending;

export async function answerPoll(path: string): Promise<unknown> {
  const reply = POLLS[path.split("?")[0]];
  return reply ? reply() : pending();
}
