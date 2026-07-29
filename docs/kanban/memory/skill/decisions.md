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

- Whether the goal is strong or weak is the agent's common-sense call, not a written
  rubric. `weak` only when it is apparent — missing, still the template, or too vague to
  plan from; anything borderline counts as strong.

## Finished cards

- A finished card moves to a `.archive/` folder next to `todo/`, kept in git, so finished
  work can still be read and diffed. A rejected card is still deleted — `rejected.md`
  already records why.
- The archive is not project memory. No flow reads it; `readme.md` plus the published docs
  stay the only record of shipped work.

## Auto-refine

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it's sure of and ends either `ready` or holding only the questions a human must
  answer.

## Where the skill folder lives

- **Who decides where the skill folder lives?**: our install prompt does, and it never asks
  which agents you use — it copies the skill into both `.claude/skills/kanban/` (Claude
  Code) and `.agents/skills/kanban/` (Codex). The skill names no agent's folder in its own
  instructions, so it also runs from wherever another installer — `npx skills add`, a
  plugin — put it.

## Storage

- The GitHub Projects backend is wanted but parked — nothing is built until we pick it up.
- Notion is a later idea; it gets a card when a user asks for it.
- We require and ship no Obsidian community plugin, so the board shows there as a grouped
  table, never as drag-and-drop columns.
- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move to another backend.
- One backend per project; the board is never mirrored to a second one.
