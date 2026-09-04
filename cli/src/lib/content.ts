// Where a marketing board's drafts live.
//
// One folder per card — `content/<id>-<slug>/` — named off the card's own filename, so the
// folder and the card always match and neither has to be looked up from the other. The
// folder is tracked in git and kept after the card is archived: the piece outlives the
// topic that asked for it.
//
// Inside it, one file per draft. `source.md` is the argument, written for the lead channel
// and never published; `<channel>.md` is that channel's own draft, repurposed from it.
//
// It is a function, not a constant, because `KANBAN` is repointed per command (./paths.ts).

import path from 'node:path'

import { KANBAN } from './paths'

/** The name the source draft goes by — the piece every channel is repurposed from. */
export const SOURCE = 'source'

/** `docs/kanban/content/` — every card's draft folder sits in here. */
export const contentDir = (): string => path.join(KANBAN, 'content')

/** The draft folder for the card held in `cardFile`. */
export const draftDir = (cardFile: string): string =>
  path.join(contentDir(), path.basename(cardFile).replace(/\.md$/, ''))

/** One draft in that folder: `source`, or a channel's name. */
export const draftFile = (cardFile: string, name: string): string =>
  path.join(draftDir(cardFile), `${name}.md`)
