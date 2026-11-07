// The plugins' local component (plugin.ts), as the host starts it: `codex` from the Codex plugin.

import { main } from './plugin'

void main(process.argv[2] === 'codex' ? 'codex' : 'claude-code')
