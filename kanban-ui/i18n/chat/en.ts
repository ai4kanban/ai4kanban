// English copy for the chat rail — the source of truth a second language mirrors
// key for key. Writing rules: `i18n/index.ts`.
import type { ChatCopy } from "./types";

const en: ChatCopy = {
  label: "Chat",
  unread: "a new reply is waiting",
  clear: "Clear this conversation",
  clearConfirm: "Clear it",
  fold: "Fold the chat away",
  aboutBoard: "the board",
  aboutBoardHint: "about the whole board",
  aboutCard: (id) => `#${id}`,
  aboutCardHint: (id, title) => `about #${id} ${title}`,
  agentMissing: (agent) =>
    `${agent} isn't installed on this machine, so a message may have nothing to reach. Pick an agent in Configuration — the ⚙ in the top row.`,
  noAgent: "No coding agent to talk to.",
  noAgentFix: "Set one up in Configuration — the ⚙ in the top row.",
  thinking: "Thinking…",
  writing: "writing",
  nothingCameBack: "nothing came back",
  stopped: "What arrived is kept — send another message to carry on.",
  youStopped: "you stopped the reply.",
  emptyBoard:
    "Ask about this project, or say what to change. It answers from this board, and it makes the changes you settle on.",
  emptyBoardAsks: [
    "What should I build next?",
    "What is holding everything up?",
    "Put #12 in v1 and drop #14.",
    "Start a build on #12.",
  ],
  emptyCard: (id) =>
    `Ask about #${id}, or say what to change. It answers from this card and the rest of the board, and it makes the changes you settle on.`,
  emptyCardAsks: [
    "What is unclear about this card?",
    "Is it too big to build in one go?",
    "What could be cut?",
  ],
  copyReply: "Copy this reply",
  copyCode: "Copy this code",
  copyChat: "Copy the conversation",
  again: "Send again",
  againHint: "Send this message again",
  reword: "Reword",
  rewordHint: "Put these words back in the box to edit",
  rewordConfirm: "Replace what's typed",
  youSaid: "You",
  agentSaid: "Agent",
  ask: "Ask, or say what to change",
  askCard: (id) => `Ask about #${id}, or say what to change`,
  message: "Your message",
  send: "Send",
  stop: "Stop",
  sendingWaits: "Sending waits for the reply",
  sendingWaitsEsc: "Sending waits for the reply · Esc stops it",
  keys: "Enter sends · Shift-Enter starts a line",
};

export default en;
