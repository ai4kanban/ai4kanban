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

- ❌ **Meta in bold lines under the title** (`**Track:** ... **Priority:** ...`) → ✅ a
  markdown frontmatter block (`title`, `track`, `priority`, `roi`, `status`, `blocked_by`,
  `related`, `questions`) so programs can parse and write it. Add `questions` for
  decisions a human still owes.
- ❌ **One feature split into sibling top-level cards** (a shared layer card plus one card
  per backend, wired together only by `blocked_by` / `related`) → ✅ a group task: a root
  card that holds the shared plan, the ordering, and the questions that span all the
  pieces, with each piece as a subtask in its folder. Siblings hide that they are one
  feature and make the same question get asked on three cards.
- ❌ **A card's stage lives only in the UI's memory** (lost on restart) → ✅ a `status`
  field in the frontmatter (`todo` / `ready` / `implementing`, default `todo`, a
  missing value reads as `todo`) so the stage is part of the board's record and survives a
  UI restart. The script is the only writer, like every other field.

## Setup

- ❌ **End setup by sorting the first cards into a v1 and a vnext group task** → ✅ end it
  with the first tasks as plain cards. Setup never asks for a release; a project that
  wants one creates it later from the release work.

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
