---
title: Let a user choose where the board is stored
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: [55, 59, 61]
modules: [skill, local-ui]
questions: []
---

Today the board can only be markdown files in `docs/kanban/`. Let a user pick where their
board lives instead: a GitHub project the whole team can see. This is a group task — it
tracks the work; each piece is its own subtask in this folder.

## Scope

- Build the storage layer first (#55). It lists every read and write the board needs, and
  every backend answers all of it. After it, nothing in the script or the UI touches files
  directly.
- The markdown board stays the default and the recommended one. A user who does nothing
  sees no change: same commands, same files, same output.
- One setting names the backend: `backend` in `docs/kanban/ui.config.json`. Picking a
  backend is the only thing a user does in this group. The Obsidian switch is a different
  card's setting (#56) and is not part of this group.
- Then move the flows onto the script (#61). Today they open card files with Read and
  Grep, which only works when the board is files.
- Then the backend people asked for: GitHub Projects (#59). It is opt-in.
- The backend card says plainly what it gives up. A board on GitHub is no longer plain
  text in git.
- Changing the setting never moves cards. A user with a board full of cards runs one move
  command, once (#55).
- Order: #55, then #61, then #59. Each one needs the one before it.
- Docs: #55 adds the page on picking a backend and the page on moving a board, #59 adds
  its own page.

## Decided

- **Local-first is a promise for the default backend, not for every backend.** The
  markdown board in git stays the default and the recommended one, and that is where the
  promise holds. Moving the board to a remote service is the user's own choice, not
  something we do for them. So we do accept a backend that gives it up: opt-in only, never
  a default, never a recommendation, and its guide says plainly what it costs. (The user's
  call.)
- **Notion is left out.** Notion stays in `goal.md` as a later idea and gets a card when
  someone asks for it. (The user's call.)

## Todo

- [ ] Put the board behind a storage layer so the backend can be swapped #55
- [ ] Add an Obsidian storage backend for the board #56
- [ ] Add a GitHub Projects storage backend for the board #59
- [x] Unblock #56 from #55 and ship it as a format option on the markdown board.
- [ ] In every backend guide, say what that backend gives up, and mark the non-default
      ones opt-in.
- [x] Move #56 out of this group into `todo/features/`, and give it its own README entry.
      It no longer changes where the board is stored, so it is not part of this group.
- [x] Drop #56 from this card's related list and stop calling it one of this group's
      backends.
- [x] Add #61 to this group: move the flows onto the script. It is blocked by #55, and
      #59 is blocked by it.
- [ ] Make every flow read and write cards through the script #61
- [x] Say in the scope that this group adds one setting, `backend`, and that the Obsidian
      switch belongs to #56.
- [ ] Cover moving a board that already has cards: one move command on #55, tested against
      a real GitHub project on #59.
- [ ] Park #59 and #61 at low priority, and build only #55 for now. The move command and
      the flow rewrite come back with them.
- [ ] Keep the settings in `docs/kanban/ui.config.json` — no `settings.json`. This reverts
      the scope line above naming that file.

## Pushback

The layer alone is a large refactor with nothing a user can see. It only pays off if a
real backend ships on top of it. If we end up shipping just one backend, a smaller change
aimed at that one backend is cheaper — so decide which backends we actually want before
starting #55.

Answered above: #59 is the card that needs the layer, and we want it. #58, the project
switcher, is blocked by #55 too, so the layer is not paid for by #59 alone. If #59 is ever
dropped, #55 still has #58 to carry it — check that card before dropping the layer.

## Decided by the agent

- **#56 leaves this group.** After the earlier call that Obsidian is a format switch on
  the same markdown files, it stopped changing where the board is stored: same folder,
  same layout, same files. The group's goal is still met with it cut, which is the test a
  refine uses, so it is split off rather than kept. The work is still wanted — the card
  moved to `todo/features/` and ships on its own.
- **The order changed.** Because #56 is out, this group is now #55, then #61, then #59, in
  that order. The layer is no longer racing a card that never needed it.
- **A user sets one thing here: `backend`.** The Obsidian switch is a second key in the
  same `settings.json`, but it answers a different question — `backend` says where cards
  live, the switch says how a card file is written. Folding one into the other would make
  the setting lie about what it does. With #56 out of the group, this card's promise is
  true as written, and a user who never opens Obsidian never sees the second key.
- **Changing the setting never moves cards.** #55 gains one move command: read every card
  from one backend, write them to the other, both ways. That is the layer's own payoff, so
  it belongs there, and #59 only has to test it against a real GitHub project. Flipping the
  setting on a board that still holds markdown cards must say so and name the command —
  never show an empty board as if it were the truth.
- **The flow rewrite is its own card, #61.** Moving every flow off Read and Grep is a
  different kind of work from the layer: #55 changes code nobody sees, #61 changes what the
  agent does on every run. Only a remote backend needs it, so as its own card it can wait
  and #55 can land as a plain refactor. It stays inside this group, because a piece of one
  feature belongs in the group, not as a loose sibling.
