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
- ❌ **A card's stage lives only in the UI's memory** (lost on restart) → ✅ a `status`
  field in the frontmatter (`todo` / `ready` / `implementing`, default `todo`, a
  missing value reads as `todo`) so the stage is part of the board's record and survives a
  UI restart. The script is the only writer, like every other field.

## Auto-refine

- ❌ **Auto-refine records every auto-answer in `decisions.md`, same as the human resolve
  flow** → ✅ keep auto-answers on the card; append to `decisions.md` only a decision that
  helps future decision-making, so it stays a short memory not a dump of every answer.
- ❌ **An auto-refined card mixes the human's original input with the agent's own
  additions** → ✅ split the card into two parts — the plan, then what the agent
  decided/refined on its own — so the additions are easy to read and audit.
