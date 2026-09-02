/** The chat rail down the right of the window. */
export type ChatCopy = {
  /** The top row's button, the rail's own heading, and what a screen reader calls
   *  the rail. */
  label: string;
  unread: string;
  clear: string;
  clearConfirm: string;
  fold: string;
  /** What this conversation is about: the whole board, or one card. */
  aboutBoard: string;
  aboutBoardHint: string;
  aboutCard: (id: number) => string;
  aboutCardHint: (id: number, title: string) => string;
  /** The agent's command isn't on this board's PATH. Said, not enforced. */
  agentMissing: (agent: string) => string;
  /** Nothing on this board can hold a conversation at all. */
  noAgent: string;
  noAgentFix: string;
  thinking: string;
  writing: string;
  nothingCameBack: string;
  /** Follows the board's own reason a reply stopped part way. */
  stopped: string;
  /** Why a reply stopped, for the seconds this window holds it before the transcript does
   *  — the board's own wording for a reply the user ended. */
  youStopped: string;
  /** The rail with nothing in it yet: what the chat is for, and what to ask it.
   *  Tuples, so a language cannot ship a shorter list than English. */
  emptyBoard: string;
  emptyBoardAsks: [string, string, string, string];
  emptyCard: (id: number) => string;
  emptyCardAsks: [string, string, string];
  /** What you can do with a message without retyping it (#269) — the words on the
   *  buttons, and the fuller labels a screen reader and a tooltip get. */
  copyReply: string;
  copyCode: string;
  copyChat: string;
  again: string;
  againHint: string;
  reword: string;
  rewordHint: string;
  /** What the Reword button becomes when something is already typed in the box — the
   *  header bin's ask-once, in the same shape. */
  rewordConfirm: string;
  /** Who said what, in a conversation copied out as markdown. */
  youSaid: string;
  agentSaid: string;
  ask: string;
  askCard: (id: number) => string;
  message: string;
  send: string;
  /** The button Send becomes while a reply is coming. */
  stop: string;
  /** The line under the box while a reply is coming (#268). The box still takes typing;
   *  only sending waits — and Esc ends a reply this board's server owns, which is the one
   *  the window can reach. */
  sendingWaits: string;
  sendingWaitsEsc: string;
  keys: string;
};
