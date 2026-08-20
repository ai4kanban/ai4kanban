# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Agents

- **The pi coding agent as an agent the board runs** — pi has no permission prompts and
  nothing keeps a run inside the project: it reads, writes and runs shell commands anywhere
  the user can. A container is the only fence it offers. Every agent we run stays in the
  repo, and we don't ship one that can write outside it.

## Goal

- **A fixed template for `goal.md`** — we don't pin down what the goal file must contain,
  the same way Claude Code and OpenClaw don't restrict what goes in `soul.md`. What we
  write instead is a best-practices guide in `docs/guides/` — advice the user can ignore,
  not a shape the agent enforces.

## Install

- **A per-agent install that writes each editor's own rules file** — Cursor and Windsurf
  both read the shared `.agents` folder, and install already writes the skill to
  `.agents/skills/kanban/`, so they work the day they install. No per-agent target to add.

## Outside sources

- **Built-in connectors that pull outside sources onto the board** — a recurring card or
  user prompt can supply the material to the idea-extraction flow. The missing connector
  belongs outside the open core; the skill only evaluates material it can already read.

## Planning

- **A second group for planning UI cards** — getting a screen agreed before it is built is
  what the spec agents group already does: its `ui-design` agent draws the layout options.
  The one piece that was needed anyway — the skill's UI design reference — moved into that
  group. One group, not two.

## Questions

- **A drawing of a screen inside an open question** — a question lives in the card's
  frontmatter, which is no place for full detail. Questions stay one short line each; when a
  card needs a screen drawn, the drawing goes in the card body as a fenced `html` block, and
  the question points at it.

## Setup

- **Ending setup with a v1 and a vnext group task** — not every project plans releases on
  day one, so setup must not ask for one. The board makes a release easy to see and easy
  to create when the user wants one, and never requires it. Setup ends with the first
  tasks, not with a version split.
- **Reading a deadline from the goal and splitting decisions by it** — the board has no
  deadlines, so nothing reads a date out of `goal.md` and every settled call lands in one
  `decisions.md`. Timing may come back later as its own feature.

## Storage

- **Mirror the board to a second backend** — two live copies means two-way sync and a
  conflict story, a product of its own rather than a setting. One backend per project.
- **Move every flow off Read and Grep and onto script commands** — the script already
  lists cards and writes a card's frontmatter, which is the part that needs one owner.
  Wrapping the rest — showing a card, searching card text, writing a card body — buys
  nothing on a file board: the agent reads files well. A backend that can't be read as
  files carries that cost itself, on its own card.
