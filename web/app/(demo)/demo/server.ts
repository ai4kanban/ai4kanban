// What kanban-ui's server actions answer on /demo (./stand-ins.cjs). The New idea sheet reads
// its own discussion on open, so that read says "a fresh one, ready to send"; every other
// action never settles, which leaves the screen exactly as it was drawn.
import type * as Actions from "ai4kanban-ui/app/actions";
import type { ChatMessage } from "ai4kanban-ui/lib/types";
import type { ChatRead } from "ai4kanban-ui/lib/chat";

type Answers = { [K in keyof typeof Actions]?: (typeof Actions)[K] };

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

const ANSWERS: Answers = {
  readChatAction: async () => chatRead([]),
  readDiscussAction: async () => ({ plan: null, plans: [], run: null, rows: [], supported: true }),
};

/** Never settles: an answer the screen would act on is one the demo does not have. */
export const pending = () => new Promise<never>(() => {});

export function answer(name: string, args: unknown[]) {
  const reply = ANSWERS[name as keyof Answers] as ((...a: unknown[]) => Promise<unknown>) | undefined;
  return reply ? reply(...args) : pending();
}
