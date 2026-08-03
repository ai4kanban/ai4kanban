# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Project memory

- ❌ **Write a note to the board-root set *and* the module's set** → ✅ pick one copy by
  the card's modules and write only there. The root set is the umbrella project's own
  memory, not a mirror of the modules; copying module notes up buries what the root is for.
- ❌ **Assume one top-level folder is one module** → ✅ a module can span several folders
  and two modules can share one, so no code maps a file path back to a module. Only the
  module's name is machine-read; where it lives is prose, a reference for the reader.

## Card format

- ❌ **A card's state lives somewhere other than the card** (the UI's memory, a side file)
  → ✅ everything about a card is a frontmatter field the script writes and nothing else
  does, so the state survives a restart and any reader can parse it.
- ❌ **One feature split into sibling top-level cards** (a shared layer card plus one card
  per backend, wired together only by `blocked_by` / `related`) → ✅ a group task: a root
  card that holds the shared plan, the ordering, and the questions that span all the
  pieces, with each piece as a subtask in its folder. Siblings hide that they are one
  feature and make the same question get asked on three cards.

## The script

- ❌ **Assume the script can find the board from where its own file sits** (it can't, from
  a read-only plugin cache) → ✅ it locates `docs/kanban/` from the working directory,
  since commands run from the repo root. Anything that moves per-project state out of the
  skill folder has to keep that true or the plugin channel silently breaks.

## The goal

- ❌ **Judge the goal by a rule in the code, so no agent run is needed** → ✅ the agent is
  the only judge of how good a goal is; the board only sees whether text is there. A rule
  that grades free-form prose is a rule that gets the user's own words wrong.
- ❌ **A goal the user just wrote stays weak until an agent re-judges it** → ✅ written but
  not judged yet is its own review value, and it never nudges. Every path that writes the
  goal has to leave the file in a state that doesn't ask for the goal again.
- ❌ **Seed a file with a paragraph explaining what belongs in it** → ✅ the file starts
  empty and the explanation sits where the user is asked for it. A seed is text the user
  deletes before they can start.

## Releases

- ❌ **A release is a group task you drag work into** → ✅ a release is a field on a card,
  so an ordinary card never has to live inside someone else's folder. A card that names
  no release is simply in no release.

## Auto-refine

- ❌ **Auto-refine records every auto-answer in `decisions.md`, same as the human resolve
  flow** → ✅ keep auto-answers on the card; append to `decisions.md` only a decision that
  helps future decision-making, so it stays a short memory not a dump of every answer.
- ❌ **An auto-refined card mixes the human's original input with the agent's own
  additions** → ✅ split the card into two parts — the plan, then what the agent
  decided/refined on its own — so the additions are easy to read and audit.
