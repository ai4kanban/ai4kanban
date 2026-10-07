// The global memories this command ships (#1575), each one's `MEMORY.md` inlined as text the
// way a built-in agent's files are (../lib/agents/bundled.ts). Keyed by name.

import competitors from './competitors/MEMORY.md'

export const BUNDLED_MEMORY_FILES: Record<string, string> = {
  competitors,
}
