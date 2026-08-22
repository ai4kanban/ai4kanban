---
title: Put the board behind a storage layer so the backend can be swapped
track: features
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [57]
modules: [skill, local-ui]
questions:
  - "[user] With GitHub (#59) parked and the project switcher rejected, no card needs this layer right now. Does the full swappable-backend layer plus the `backend` setting still ship now, or wait until a second backend actually arrives?"
---

Today the board can only be markdown files in `docs/kanban/`. Put one storage layer in
between so a user can pick where their board lives.

Part of #57. There is one backend today — the markdown board — so the layer ships as the
seam a later backend plugs into.

## Scope

- Write down every read and write the board needs. From `kanban.mjs`: list cards, read one
  card, write a card, move a card between tracks, delete a card, allocate the next id,
  keep the index, keep `metrics.csv`, read and write the memory files. From `kanban-ui`:
  the same reads, plus the run logs and the settings file.
- That list is the storage interface. Every backend must answer all of it.
- Make the current markdown board the first backend behind that interface. It stays the
  default and the recommended one. Nothing changes for a user who does nothing.
- Add a setting that names the backend: `backend` in `docs/kanban/ui.config.json`. Default
  is the markdown board.
- Route `kanban.mjs` through the layer instead of touching files directly.
- Route `kanban-ui` through the same layer. It reads `docs/kanban/` directly today
  (`lib/paths.ts`, `app/actions.ts`, `lib/modules.ts`), so it needs the same change or the
  UI breaks on any other backend.
- The agent keeps opening card files with Read and Grep. Every backend we support is files
  on disk, so no flow changes. Script read commands wait for a backend that needs them.
- No move command yet. Changing the setting still never moves cards, but with one backend
  there is nothing to move between. The command comes with the second backend.
- No behavior change for the default backend. Same commands, same files, same output.

## Todo

- [ ] Write the list of reads and writes the board needs, from `kanban.mjs` and `kanban-ui`.
- [ ] Turn that list into one storage interface, in one place.
- [ ] Implement the markdown backend against the interface, keeping today's file layout.
- [ ] Make a backend something you open for one board, not one thing the whole process
      shares. A layer that bakes in one board per run has to be undone by anything that
      later opens two.
- [ ] Add the `backend` key to `docs/kanban/ui.config.json`, defaulting to the markdown
      board.
- [ ] Make `kanban.mjs` read `docs/kanban/ui.config.json`. It reads no config file today.
      Take only the `backend` key; leave the UI's own keys alone.
- [ ] Move `kanban.mjs` onto the interface — no direct file access left.
- [ ] Move `kanban-ui` onto the interface — no direct file access left.
- [ ] Keep the memory set, `metrics.csv` and `next-id` as local files on every backend —
      only cards move.
- [ ] Check that a board with no setting behaves exactly as it does today.
- [ ] Point `config.md` at `ui.config.json` for the backend, in one line, with no value.
- [ ] In `SKILL.md`, name `docs/kanban/ui.config.json` and the `backend` key only. Do not
      mention `command`, `autoRefine`, or how the UI starts an agent.

## Decided

- **Every backend is files on disk, so no flow changes.** The markdown board, and Obsidian
  on top of the same files — the agent keeps reading cards with Read and Grep, and the
  script gains no read commands here.
- **The setting lives in `docs/kanban/ui.config.json`.** The file is already there and the
  UI already reads it. The script starts reading it too, for the `backend` key. The cost:
  the file's name says UI while the script reads it, and the skill has to name the file for
  the first time. So the skill names this one file and only the `backend` key; `command`
  and `autoRefine` stay the UI's own business and the skill still never mentions them or
  how the UI launches an agent.
- **The memory set stays local markdown on every backend.** The five files, `metrics.csv`
  and `next-id` never move. Only cards do.
- **One backend per project.** No mirroring to a second one.

## Decided by the agent

- **The memory set stays local markdown on every backend.** Reasons: the agent reads memory
  on almost every run, so a network round trip is the wrong price; a remote board has no
  good home for prose the board does not own; and `goal.md`'s plain-text promise holds for
  the part the agent thinks with. A team sharing a remote board shares the cards, not the
  memory.
- **One backend per project.** No mirroring to a second one. Two live copies means two-way
  sync and a conflict story, which is a product of its own, not a setting. A user who wants
  to move switches the setting and imports once.
- **Switching the setting never moves cards.** Moving a board is one command you run once,
  reading every card from one backend and writing it to the other. The interface is what
  makes it one small command instead of a converter per pair of backends. It ships with the
  second backend.
