# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Goal

- **A fixed template for `goal.md`** — we don't pin down what the goal file must contain,
  the same way Claude Code and OpenClaw don't restrict what goes in `soul.md`. What we
  write instead is a best-practices guide in `docs/guides/` — advice the user can ignore,
  not a shape the agent enforces.

## Outside sources

- **Built-in connectors that pull outside sources onto the board** — a recurring card or
  user prompt can supply the material to the idea-extraction flow. The missing connector
  belongs outside the open core; the skill only evaluates material it can already read.

## Setup

- **Ending setup with a v1 and a vnext group task** — not every project plans releases on
  day one, so setup must not ask for one. The board makes a release easy to see and easy
  to create when the user wants one, and never requires it. Setup ends with the first
  tasks, not with a version split.
- **Reading a deadline from the goal and splitting decisions by it** — the board does not
  support deadlines for now. Setup reads no date out of `goal.md`, no step asks for one,
  and no `decisions-v2.md` parks the calls that could wait — every settled call lands in
  `decisions.md` alike. Timing may come back later as its own feature.

## Storage

- **Mirror the board to a second backend** — two live copies means two-way sync and a
  conflict story, a product of its own rather than a setting. One backend per project.
