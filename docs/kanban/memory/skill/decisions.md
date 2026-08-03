# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## The memory set

- The set is five files. There is no `archive.md`: a file nothing writes is exactly the
  leftover we avoid. What shipped is recorded in the published docs, with a `readme.md`
  line pointing at them.
- What the agent decided by itself stays on the card, in its own section, so the user can
  check it. Only a call a future card would need reaches `decisions.md`.

## The goal

- The agent judges only whether a goal is there, never the prose: missing or still seed
  text is `weak`, anything the user wrote is at least `good`. Nagging about a goal the
  user did write is worse than no nag.
- What a good goal contains is advice in a guide setup links to — the business goal, the
  long horizon, a rough roadmap, the direction. Nothing enforces it and the file stays
  free-form.

## Finished cards

- A finished card moves to a `.archive/` folder next to `todo/`, kept in git, so finished
  work can still be read and diffed. A rejected card is still deleted — `rejected.md`
  already records why.
- The archive is not project memory. No flow reads it; `readme.md` plus the published docs
  stay the only record of shipped work.

## Setup

- Setup asks the user for one thing, the goal. It settles what the goal answers into
  `decisions.md`, and hands over every call it can't settle as `[user]` questions on one
  card that tops the board — never in the checklist, never in `decisions.md`, which holds
  only settled calls.
- Without a written `goal.md` setup stops at the goal step: nothing after it can be built
  from seed text, so there are no decisions, no module map, no first cards. A later run
  picks up from there.
- The module map comes after the decisions. A project started without code has no code to
  read a map from — the map can only come from what's been decided.
- Setup ends with 10 first cards, the ones later work builds on — never improvements aimed
  at what the project hasn't built yet.
- While `setup-checklist.md` is there the board is unfinished and no flow creates a card;
  the last tick deletes it, and a finished checklist is never kept as a record. A card the
  user writes by hand, outside the skill, is never blocked.

## The module map

- Be conservative, above all in a from-scratch repo — a simple single-purpose project is
  one module, not several. Add lines only as the code grows.
- Adding a module later moves the notes that are now clearly its own out of the memory
  they came from, once. A rename keeps the memory with the module; deleting one folds its
  memory back into the project-wide set, so nothing we learned is lost with the map line.

## Auto-refine

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it's sure of and ends either `ready` or holding only the questions a human must
  answer.

## Recurring tasks

- A built-in background job (say, pruning the memory) ships as a seeded card in the
  recurring track, run when the user sets a cadence — never as its own UI switch with its
  own state file. The card is the visible, editable record of the job; deleting it is the
  opt-out, and nothing re-adds it behind the user's back.
- A cadence is always the units grammar — `30m`, `2h`, `1d`, `1d at 09:30`. There is no
  word form like `daily` anywhere, so nothing has to translate between two.

## Open questions

- A question can carry options — `single-option` to pick one, `multi-options` to pick as
  many as you want — and one with no options stays an open-ended ask.
- A question written as prose with the choices inside it keeps working and is never
  rewritten. Both shapes live side by side; no card is migrated.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the
  release off the cards still open; they are never moved into the release afterwards.
- The open releases are one line each in `docs/kanban/releases.md`, in ship order, holding
  only what is still ahead — short enough that reordering and renaming are hand edits.
- A version id is letters, numbers, dot, dash and underscore, kept as typed. A card with
  no release has an empty field; there is no sentinel name for that state.
- A card naming a release that is not on the list keeps it, and `release list` names the
  id so it can be put back. The board never clears the field and never refuses to run over
  it — but setting a release the list doesn't have is still an error, so a typo can't
  invent a version.
- Filling a release takes the cards in no release that are high priority, have nothing
  open blocking them, and are not a group root. It never reads a card to judge how big it
  is: a plain rule the user can predict beats a smarter one they have to check.

## Installing and updating

- Our GitHub repo is `ai4kanban/ai4kanban` — every link, manifest, and install
  instruction names it, and nothing leans on the old `dist0com` redirect.
- A user installs and updates by running one Node script published on npm —
  `npx ai4kanban install` and `npx ai4kanban update`. No shell script, no `curl … | sh`,
  no git clone: the package carries the skill folder. The plugin channel is unaffected.
- Install never asks which agents you use; it copies the skill into both
  `.claude/skills/kanban/` and `.agents/skills/kanban/`. The skill names no agent's folder
  in its own instructions, so it also runs from wherever another installer put it.

## Storage

- The GitHub Projects backend is wanted but parked — nothing is built until we pick it up.
  Notion is a later idea; it gets a card when a user asks for it.
- We require and ship no Obsidian community plugin, so the board shows there as a grouped
  table, never as drag-and-drop columns.
- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move. One backend per project; the board is never mirrored to a second one.
