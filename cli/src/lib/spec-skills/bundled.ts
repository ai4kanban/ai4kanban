// The skill files this command ships, inlined into the one built file.
//
// One entry per file, keyed by its path inside `src/skills/`. The bundler turns each import
// into the file's text (`loader: {'.md': 'text'}` in scripts/build.mjs), the way the flows
// are carried, so `akb` needs no folder on disk to run a built-in skill.
//
// This list is the whole of what TypeScript knows about a built-in skill: no name, no
// description, no setting. All of that is read out of the `SKILL.md` the same way a
// project's own skill is read, so adding a built-in skill is adding files and the two lines
// naming them here.

import uiDesign from '../../skills/ui-design/SKILL.md'
import uiDesignAscii from '../../skills/ui-design/references/ascii-drawing.md'
import uiDesignRendered from '../../skills/ui-design/references/rendered-screen.md'
import technologySelection from '../../skills/technology-selection/SKILL.md'

export const BUNDLED_SKILL_FILES: Record<string, string> = {
  'ui-design/SKILL.md': uiDesign,
  'ui-design/references/ascii-drawing.md': uiDesignAscii,
  'ui-design/references/rendered-screen.md': uiDesignRendered,
  'technology-selection/SKILL.md': technologySelection,
}
