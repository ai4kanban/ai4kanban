---
title: "auto-implement: let the agent build a ready card on its own"
track: skill
priority: low
roi: med
status: todo
blocked_by: []
related: [45]
modules: [local-ui]
questions:
  - "[user] An auto-implement loop runs card after card unattended. What stops it — a spend cap per run, a limit on how many cards it may do in a row, or nothing?"
---

Add one switch that lets the UI build a `ready` card on its own, the same way the
auto-refine switch already lets it refine one. A user who trusts the agent should not
have to click Implement on every card.

This card started as four autonomy levels. One of them, auto-design, already shipped as
the auto-refine switch. What is left is one buildable level — auto-implement — plus two
that are not startable yet (see "Not in this card").

## Scope

- A new switch in `docs/kanban/ui.config.json`, next to `autoRefine`. Off by default; a
  missing key or a missing file also counts as off.
- One more toggle inside the Configuration (gear) dialog, under the auto-refine one. No
  new control in the header.
- When it is on, the background dispatcher may also start an **implement** run by
  itself. It picks the same way it picks a card to refine: highest priority first, one
  run at a time.
- A card is eligible when its status is `ready`, it has no open questions, and its todos
  are not all ticked.
- A card whose last auto-implement run failed, or ended with its todos unchanged, is not
  picked again. This rule is this card's own to write, because nothing else on the board
  picks the same card twice.
- The run leaves its code uncommitted in the working tree. It does not commit, branch, or
  open a pull request. You read `git diff` and commit, like after any run today.
- The run does not archive the card. You still review the work and click Archive.
- Only the UI reads this switch. The skill's flows never check it — a skill run behaves
  the same however it was started.

## What the user does

- Opens the gear dialog and turns the switch on. The dialog says in plain words that the
  agent will start writing code on its own, and that it never commits.
- Marks a card `ready`. Within a minute the card shows the running badge and its page
  shows the live read-only log, exactly like a run you started yourself.
- When the run ends, the todos are ticked and the changes sit in `git diff`. The user
  reviews, commits, and archives.
- Turning the switch off stops new runs. A run already going finishes.

## Not in this card

- **auto-archive** (the agent closes the card too) — wait for card #47. Archive still
  deletes the card file, and a run's code is uncommitted, so an unattended archive would
  drop the card with nothing committed to show for it.
- **auto-reject** (the agent drops a card by itself) — nothing today ever decides a card
  should be rejected, so a switch alone would do nothing. It needs an automatic
  "already shipped or a duplicate" check first. That is a feature, not a setting.

## Todo

- [x] Answer the open questions (resolve flow) — see "Decided by the agent".
- [x] Decide where the setting lives — `ui.config.json`, next to `autoRefine`.
- [ ] Answer the one question left: what stops the loop.
- [ ] Add the new key plus its read/write pair, with a missing key reading as off.
- [ ] Add the toggle to the Configuration dialog.
- [ ] Teach the dispatcher to pick a `ready` card and start an implement run.
- [ ] Add the "don't pick a card whose last run failed" rule.
- [ ] Build the stop rule the open question decides.
- [ ] Document the switch in `kanban-ui/README.md` and the daily-loop guide.

## Decided by the agent

- **Ship a level now, or park it?** — Don't park it. One level already shipped: auto-design
  is the auto-refine switch, it runs in the background dispatcher, and it is on in this repo
  (`docs/kanban/ui.config.json`). Root `decisions.md` records that switch as the whole
  auto-design idea, and the skill's `readme.md` lists auto-refine as shipped. So this card is
  now only about the three siblings left, and turning any of those on is the user's trust
  call, not a readiness question.
- **Where the config lives** — In `docs/kanban/ui.config.json`, next to `autoRefine`, flipped
  from the UI's Configuration dialog; root `decisions.md` already says further levels "sit next
  to it as sibling settings". Not `config.md` — that file is prose for the agent to read, no code
  parses it (`kanban.mjs` only seeds it), and a toggle can't write it. The skill itself never reads
  the switch: only the UI dispatcher does (`readAutoRefine()` in `kanban-ui/lib/dispatcher.ts`),
  and with no UI installed nothing auto-runs anyway.
- **What happens to the code auto-implement writes** — It stays uncommitted in the working
  tree, same as a run today. Nothing here touches git: the Implement prompt in
  `kanban-ui/lib/agent.ts` never mentions committing, no skill flow commits (`update.md` tells
  the user to review `git diff` first), and the already-shipped auto-refine writes card files
  unattended and leaves them for the human to commit. Branches and pull requests are the
  worktree model we point at vibe-kanban for — a separate card, not part of this switch.
- **What a run must check before it archives** — Not tests: this repo has none — no test
  files, no test script in `kanban-ui/` or `web/`, no CI config. So the gate is what already
  exists: every todo ticked (the same rule the human's Archive button uses, `visibleActions`
  in `kanban-ui/components/CardPage.tsx`), the `readme.md` line the skill's archive flow asks
  for, plus CLAUDE.md's pre-commit checks when the run changed code. Archiving deletes the
  card file today (`cmdRemove` in `kanban.mjs`), so a run that can't tick every todo must
  leave the card on the board.
- **What would start an auto-reject** — Nothing today. Every reject is the human's: the
  Reject button is always shown (`visibleActions` in `CardPage.tsx`) and the prompt in
  `kanban-ui/lib/agent.ts` only carries the reason the user typed. The auto-refine loop doesn't
  reach one either — it runs `refine.md` and stops at rewriting or raising questions, and
  goal-fit drift is trimmed or split off, never rejected. The one flow that ends in "reject it"
  is refine's Value check (no user is better off, already shipped, or another card owns it),
  and nothing runs it unattended. So this switch needs that check wired into the auto-refine
  pass, and only its evidence half: "already shipped or a duplicate" can be settled by
  searching, while the value-and-direction half stays human — refine says raise a question when
  you can't decide, `add-task.md` says never drop a task without asking, and `reject` deletes
  the card file for good (`cmdRemove` in `kanban.mjs`).
- **Which of the three toggles do we build?** — Only auto-implement, and this card shrinks
  to that. It needs no new machinery: the `implement` action and prompt already exist
  (`kanban-ui/lib/agent.ts`) and the dispatcher already picks a card and starts a run with
  nobody watching (`kanban-ui/lib/dispatcher.ts`), so the switch is one more boolean next to
  `autoRefine`. Its only gate left is the stop rule in the other open question. auto-archive
  waits for card 47: archive still deletes the card file (`fs.rmSync` in `kanban.mjs`) and a
  run leaves its code uncommitted, so an unattended archive would drop the card with nothing
  committed to show for it. auto-reject is its own card — the automatic check does not exist
  yet, and building it is a feature, not a switch; the config still says how far agents go
  alone without that level.

## Pushback

- The switch is small. What it starts is not: an agent writing code with nobody watching,
  card after card. Do not ship it before the stop rule in the open question.
- Every run leaves its diff uncommitted in one working tree. Two cards built back to back
  means two unreviewed diffs mixed together. The stop rule has to keep that pile small
  enough to read.
- The same money question sits open on card #45. Answer both with the same number, in the
  same place.
