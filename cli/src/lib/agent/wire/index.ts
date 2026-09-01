// How the board talks to an agent's process — the one door onto it.
//
// Every connector reaches the model through a command the board spawns, and there are only
// two ways that command can behave:
//
//   PRINTS   started with the prompt on its command line, prints NDJSON, exits. We parse.
//            One renderer per agent (`*-stream.ts`), all answering `StreamRenderer`.
//   TALKS    stays up and holds a conversation over its own stdin and stdout, asking us
//            things as it goes. One client per protocol (`acp.ts`, `zcode.ts`), both
//            answering `RunClient` and both held over `rpc.ts`.
//
// Everything vendor-specific stops here. What leaves this folder is text for a log, the
// run's result, its tokens, its cost and its resume id — and the runner (agent/watch.ts,
// agent/chat.ts) learns no agent's format.
//
// Import from `./wire`, not from a file inside it: the files below are this folder's own
// business and the split between them will keep moving.

export { createStderrFilter, type StreamRenderer } from './stream'
export { createStreamRenderer } from './claude-stream'
export { createCodexStreamRenderer } from './codex-stream'
export { createCursorStreamRenderer } from './cursor-stream'
export { createKimiStreamRenderer } from './kimi-stream'
export { createOpencodeStreamRenderer } from './opencode-stream'

export { createAcpClient, type AcpOptions } from './acp'
export { createZcodeClient, type ZcodeOptions } from './zcode'
export type { ClientTurn, RunClient, TurnEnd } from './client'
