---
title: Add a built-in recurring card that prunes the memory
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: [139]
related: []
modules: [skill]
questions: []
---

Give every board a recurring card that prunes the memory, so the memory files stay short without the user asking. It is also the first card in the recurring track — a working example of the type.

## Scope
- `kanban init` seeds one card in `todo/recurring/` on a new board: **Prune the memory**. Its `## Process` is one agent step — prune every memory copy, project-wide and per module, following `references/prune-memory.md`.
- The card ships without a `cadence`, so nothing runs by itself. Its body says how to turn on a daily prune: set the cadence to `1d`. That is the only way a cadence is ever written — there is no `daily` word form beside it. Once a cadence is set, the dispatcher from #139 runs the card in the background like any other recurring card.
- Deleting the card is the opt-out, and it sticks: re-running `init` on an existing board never re-adds it. `references/prune-memory.md` gets a short note on recreating the card for a board that wants it back.
- No Auto-prune switch and no `docs/kanban/.ui-state.json` — the card and its `cadence` replace both.

## Todo
- [x] Seed the "Prune the memory" card in `kanban init` on new boards only: a one-step `## Process` that follows `references/prune-memory.md`, no cadence, and a body line on turning on daily runs.
- [x] Make sure re-running `init` on an existing board never re-adds the card.
- [x] Add a note to `references/prune-memory.md` on recreating the card after deleting it.
- [x] Mention the seeded card in SKILL.md's Auto-pruning section, one line.
- [ ] Once #139 ships, replace the pointer to the recurring-task guide in the seeded card's body with the one thing a user has to do to turn on a daily prune: set the cadence to `1d`.
- [ ] Set the cadence to `1d` on the seeded card of a scratch board and watch the dispatcher start the prune run on its own.

## Decided by the agent
- Its own scheduler, or the recurring-task machinery? — Reuse it. A recurring card already carries `last_run`, and its `cadence` and background runs come with #139; a second scheduler wired to one job would duplicate all of it. The earlier plan's Auto-prune switch and `.ui-state.json` state file are dropped.
- Where does the last-prune time live? — In the card's `last_run` frontmatter, in git. The team shares one daily prune instead of one per machine.
- On or off by default? — Off: the card ships without a cadence and only runs when clicked, matching auto-refine's off-by-default.
- What if the user deletes the card? — That is the opt-out. Nothing re-adds or re-downloads the card behind the user's back; the prune-memory guide says how to recreate it.
- Which memory copies? All of them — the project-wide copy and each module's, as the prune flow already says.
- Does the seeded card count as work created? — No. It is board furniture the script wrote, not work anyone planned, so `metrics.csv` stays at zero on a fresh board. Running it still counts as a completion, like any recurring card.
- Does it show in the board index? — No. Recurring cards are never listed in `todo/README.md`; the seeded card follows that.
- What id does it take? — The second one. The setup questions card keeps id 1 so it stays on top.
