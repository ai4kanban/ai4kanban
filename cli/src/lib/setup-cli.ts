// `akb install`, `akb skill` and `akb update` reach the same tree as every other command
// (./agent-cli.ts). This name is what `bin/ai4kanban.mjs` asks for.

import { runAgent, type RunAgentOptions } from './agent-cli'

export type RunSetupOptions = RunAgentOptions

export const runSetup = (argv: string[], options: RunSetupOptions = {}): Promise<number> => runAgent(argv, options)
