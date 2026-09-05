// The agent files this command ships, inlined into the one built file.
//
// One entry per file, keyed by its path inside `src/agents/`. The bundler turns each import
// into the file's text (`loader: {'.md': 'text'}` in scripts/build.mjs), the way the flows
// are carried, so `akb` needs no folder on disk to run a built-in agent.
//
// This list is the whole of what TypeScript knows about a built-in agent: no name, no
// description, no setting. All of that is read out of the `AGENT.md` the same way a
// project's own agent is read, so adding a built-in agent is adding files and the two lines
// naming them here.

import uiDesign from '../../agents/ui-design/AGENT.md'
import uiDesignAscii from '../../agents/ui-design/references/ascii-drawing.md'
import uiDesignRendered from '../../agents/ui-design/references/rendered-screen.md'
import technologySelection from '../../agents/technology-selection/AGENT.md'

export const BUNDLED_AGENT_FILES: Record<string, string> = {
  'ui-design/AGENT.md': uiDesign,
  'ui-design/references/ascii-drawing.md': uiDesignAscii,
  'ui-design/references/rendered-screen.md': uiDesignRendered,
  'technology-selection/AGENT.md': technologySelection,
}
