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

import codeReviewer from '../../agents/code-reviewer/AGENT.md'
import copywriting from '../../agents/copywriting/AGENT.md'
import deckBuilder from '../../agents/deck-builder/AGENT.md'
import deckPlanner from '../../agents/deck-planner/AGENT.md'
import slidesExample from '../../agents/deck-planner/references/slides.example.json'
import slidesSchema from '../../agents/deck-planner/references/slides.schema.json'
import slidesValidator from '../../agents/deck-planner/scripts/validate-storyboard.mjs' with { type: 'text' }
import hyperframesEditor from '../../agents/hyperframes-editor/AGENT.md'
import hyperframesRecorder from '../../agents/hyperframes-editor/record.mjs' with { type: 'text' }
import scriptwriter from '../../agents/scriptwriter/AGENT.md'
import scriptwriterRecipes from '../../agents/scriptwriter/references/index.md'
import storyboardContract from '../../agents/scriptwriter/references/storyboard-contract.md'
import storyboardExample from '../../agents/scriptwriter/references/storyboard.example.json'
import storyboardSchema from '../../agents/scriptwriter/references/storyboard.schema.json'
import storyboardValidator from '../../agents/scriptwriter/scripts/validate-storyboard.mjs' with { type: 'text' }
import scriptwriterTts from '../../agents/scriptwriter/scripts/tts.mjs' with { type: 'text' }
import scriptwriterVoices from '../../agents/scriptwriter/references/voices.md'
import compositionIndex from '../../agents/scriptwriter/references/composition/index.md'
import compositionProductLaunchFilms from '../../agents/scriptwriter/references/composition/product-launch-films.md'
import compositionToolingShownWorking from '../../agents/scriptwriter/references/composition/tooling-shown-working.md'
import compositionMotionSoundEffects from '../../agents/scriptwriter/references/composition/motion-sound-effects.md'
import compositionWorkflowsIntegrations from '../../agents/scriptwriter/references/composition/workflows-integrations.md'
import compositionShaderTransitions from '../../agents/scriptwriter/references/composition/shader-transitions.md'
import desktopFocusRecipe from '../../agents/scriptwriter/recipes/desktop-overview-focus-interact-hold/recipe.md'
import desktopFocusDemo from '../../agents/scriptwriter/recipes/desktop-overview-focus-interact-hold/demo.tsx'
import uiDesigner from '../../agents/ui-designer/AGENT.md'
import uiDesignerRendered from '../../agents/ui-designer/references/rendered-screen.md'
import techStackAdvisor from '../../agents/tech-stack-advisor/AGENT.md'

export const BUNDLED_AGENT_FILES: Record<string, string> = {
  'code-reviewer/AGENT.md': codeReviewer,
  'copywriting/AGENT.md': copywriting,
  'deck-builder/AGENT.md': deckBuilder,
  'deck-planner/AGENT.md': deckPlanner,
  'deck-planner/references/slides.example.json': slidesExample as unknown as string,
  'deck-planner/references/slides.schema.json': slidesSchema as unknown as string,
  'deck-planner/scripts/validate-storyboard.mjs': slidesValidator,
  'hyperframes-editor/AGENT.md': hyperframesEditor,
  'hyperframes-editor/record.mjs': hyperframesRecorder,
  'scriptwriter/AGENT.md': scriptwriter,
  'scriptwriter/references/index.md': scriptwriterRecipes,
  'scriptwriter/references/storyboard-contract.md': storyboardContract,
  // TypeScript reads a `.json` import as data; the bundler hands over its text.
  'scriptwriter/references/storyboard.example.json': storyboardExample as unknown as string,
  'scriptwriter/references/storyboard.schema.json': storyboardSchema as unknown as string,
  'scriptwriter/scripts/validate-storyboard.mjs': storyboardValidator,
  'scriptwriter/scripts/tts.mjs': scriptwriterTts,
  'scriptwriter/references/voices.md': scriptwriterVoices,
  'scriptwriter/references/composition/index.md': compositionIndex,
  'scriptwriter/references/composition/product-launch-films.md': compositionProductLaunchFilms,
  'scriptwriter/references/composition/tooling-shown-working.md': compositionToolingShownWorking,
  'scriptwriter/references/composition/motion-sound-effects.md': compositionMotionSoundEffects,
  'scriptwriter/references/composition/workflows-integrations.md': compositionWorkflowsIntegrations,
  'scriptwriter/references/composition/shader-transitions.md': compositionShaderTransitions,
  'scriptwriter/recipes/desktop-overview-focus-interact-hold/recipe.md': desktopFocusRecipe,
  'scriptwriter/recipes/desktop-overview-focus-interact-hold/demo.tsx': desktopFocusDemo,
  'ui-designer/AGENT.md': uiDesigner,
  'ui-designer/references/rendered-screen.md': uiDesignerRendered,
  'tech-stack-advisor/AGENT.md': techStackAdvisor,
}
