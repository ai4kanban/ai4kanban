---
title: Add a GitHub Projects storage backend for the board
track: features
priority: low
roi: med
status: todo
blocked_by: [55]
related: [57]
modules: [skill, local-ui]
questions: []
---

Let a user keep the board in GitHub, so a team can see and edit it without cloning the
repo. This is the first backend that is not files on disk, so it is the harder one.

Part of #57. It needs the storage layer from #55.

## Scope

- Build one backend against the storage layer from #55. No new interface.
- Map every card field to something GitHub has: title, track, priority, roi, status,
  blocked_by, related, modules, questions. Some become fields or labels, some go in the
  body. Write the map down before writing code.
- Map the card body — summary, Scope, Todo — into the issue body. Todos become GitHub
  checkboxes, which the user can then tick in the browser.
- Ids: GitHub gives its own numbers. Decide whether our task id stays ours and is stored
  alongside, or is replaced by the GitHub number. Everything on the board points at ids,
  so this choice touches every flow.
- The agent cannot open a card with Read here, so this backend has to give the flows
  another way in: commands that show a card, search card text, and write a card body. That
  is this card's own cost — a file board never needs it.
- Moving a board that already has cards is #55's move command. Here it only has to be
  tested for real: markdown board in, GitHub board out, and back again.
- Handle the network: a call can fail, be slow, or hit a rate limit. A failed write must
  not leave the board half-updated.
- `metrics.csv` and the memory files have no GitHub home. #55 decides where the memory
  files live; this card only has to follow that call and say where metrics go.

## Todo

- [ ] Write the field map: each card field to its GitHub home.
- [ ] Write the body map: summary, Scope, Todo to the issue body and checkboxes.
- [ ] Decide the id scheme and how the board's cross-references keep working.
- [ ] Implement the backend against the #55 interface.
- [ ] Handle failed, slow, and rate-limited calls without corrupting the board.
- [ ] Decide where metrics live, and follow #55's call on the memory files.
- [ ] Test the whole loop against a real GitHub project: create, refine, resolve, archive, reject.
- [ ] Check `kanban-ui` works against it.
- [ ] Add a guide page in `docs/guides/` on using the board with GitHub, listing what it cannot do.
- [ ] Add a line to `web/` copy about GitHub support (doc only — do not touch page code).
- [ ] Store a card as one issue, and add every issue to one Project v2 as an item.
- [ ] Put `track`, `priority`, `roi` and `status` in Project single-select fields, so the
      team can group the board by them and change them in the browser.
- [ ] Read a field a user changed in the Project view back onto the card — moving a card
      in the browser must be a real change, not something we overwrite.
- [ ] Use `gh` for every call, and say in the guide that `gh` must be installed and
      logged in.
- [ ] Check `gh` is present and authorized before the first call, and say what to run if
      it is not.
- [ ] Keep the memory set, metrics, and next-id local, as #55 decided. Only cards go to
      GitHub.
- [ ] In the guide: this backend is opt-in, it is not local-first, and here is what that
      costs — no board history in git, no offline use, a network call per change.
- [ ] Test #55's move command on a board that already has cards: move it into a real
      GitHub project, check every card arrived, then move it back.

## Pushback

This backend goes against two things we have already written down. `goal.md` calls
local-first a core promise: the board is plain text in git, reviewable and revertable.
`rejected.md` turned down a database-backed board because it hides the board behind a
dependency. A hosted GitHub board has the same shape — no git history of the board, no
offline use, an API and a token in the way.

`goal.md` does list GitHub Issues under pluggable storage, so it is not out of bounds. But
it should ship as an opt-in backend that we name the trade-offs for, never as a default or
a recommendation. If we are not willing to write that trade-off down in the guide, we
should not ship it.

Local-first is the promise of the default backend. Moving the board to a remote service is
the user's choice, not ours. So this ships opt-in, never as a default, and the guide says
what it gives up.

## Decided by the agent

- **Issues are the store, one Project v2 is the view.** A card is one issue; every issue
  is an item in one Project. `track`, `priority`, `roi` and `status` become the Project's
  single-select fields, so the team can group the board by them and change them by moving
  a card in the browser. Labels alone would give a list, not a board, and a label cannot
  be grouped into columns. `goal.md` says "GitHub Issues" and the request says Projects —
  a Project item *is* an issue, so this is both.
- **What that costs.** Project v2 is GraphQL only, so this backend is more code than a
  labels-and-issues one, and it needs a Project to exist before the board works. We take
  that: without it there is no board a team can actually use.
- **Auth is `gh`.** We require the `gh` CLI, installed and logged in. It already stores
  and refreshes the token, handles enterprise hosts, and runs GraphQL with `gh api
  graphql` — so we ship no secret handling and keep no token of our own. A token in the
  environment still works, because `gh` itself reads `GH_TOKEN` and `GITHUB_TOKEN`, so CI
  needs nothing extra from us. Our users already run a coding agent in a terminal, so `gh`
  is a small ask.
