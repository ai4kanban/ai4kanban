---
title: Await every board write so events can hang off it
track: skill
priority: high
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [325]
modules: [skill]
questions: []
---

Make every board write finish before its caller moves on. Three writes are fired and never
awaited today, and one of them archives a card from inside a board *read*. That is harmless
while a Local board resolves synchronously, and it stops being harmless the moment #319 hangs
a publisher off "after a successful board write" — there is no successful moment to hook, and
the write it should have published may still be in flight.

## Worth noting
- **This is a Local correctness fix that 0.8.0 needs early**: it changes no behaviour a user
  can see today, and #319's publisher cannot be correct without it. The cost is touching the
  delivery and run paths in a release whose headline is elsewhere.
- **The archive moves out of the read**: a card page's read currently ends a delivery and
  archives the card as a side effect. Doing it where the board is read means any reader can
  cause a write, so the caller cannot know when the board is settled. It beat leaving the call
  in place and awaiting it, which would make a read that writes an awaited read that writes.
  The cost is the single poll in which the card page showed the finished delivery's commit
  before the card disappeared.

<!-- agent -->

## Today
- `cli/src/lib/agent/deliveries.ts:552` runs `void completeCard(...)` inside `manualSettled`,
  and its comment says the call is started rather than awaited because the Local board's call
  resolves synchronously.
- `manualSettled` is reached only through `attachDelivery` in `cli/src/lib/view/read.ts:244`,
  which `findCard` calls. `findCard` is synchronous and has callers in `view/edit.ts`,
  `commands/run.ts` and `agent/refine.ts`; `readCard` at `cli/src/lib/board/local.ts:213` is
  the only one that can await.
- `closeRun` in `cli/src/lib/agent/sessions.ts:686` is `async`. `cli/src/lib/agent/watch.ts`
  calls it without awaiting at lines 67, 81 and 156 — three early exits — and awaits it at
  line 254.
- `claimCard` in `cli/src/lib/agent/sessions.ts:226` is `async`, and
  `cli/src/lib/agent/watch.ts:98` passes it into `patch` as `(r) => claimCard(r)`. `patch`
  types its callback `(run: RunRecord) => void` and runs it inside `withStore`, which holds
  the run record's file lock, so the call cannot be awaited where it stands.
- `void finish(...)` at `watch.ts:319`, `:333` and `:351` is not one of these: `finish` is
  what resolves `watchRun`, and its callers are stream and signal callbacks that cannot await.
- The `changed` branch of `manualSettled` writes the delivery record from that same read. A
  delivery record is not the board, and #319 publishes nothing off it.
- #319 runs the shared local publisher after every successful desktop, CLI, or agent board
  write, and records the publication in a local outbox before sending it.
- #316 held this fix for the release that puts a network between the app and the board. It
  ships here instead, because #319 needs it first and #311 is in no release.

## Scope
- Await every board write, so a caller that returns has a board that settled.
- Take the card archive out of the card page's read: `manualSettled` reports the state it
  found, and `readCard` in `cli/src/lib/board/local.ts` ends the finished delivery and awaits
  its completion.
- Await `closeRun` on the three early exits in `watch.ts` that start it and move on.
- Claim the card outside `patch`: record the prior stage in the run record, then await the
  card write with the run record's lock released.
- Leave what a user sees unchanged, apart from the one poll named above: the same deliveries
  end, the same cards are archived, and the same runs close.
- Out of scope: the revision-on-save conflict path a second teammate needs, which stays #316's.
- Out of scope: the delivery-record write the `changed` branch makes from the same read.

## Todo
- [ ] Make `manualSettled` report state without writing, and end and complete the finished
      delivery from `readCard` in `cli/src/lib/board/local.ts`.
- [ ] Await `closeRun` at `watch.ts:67`, `:81` and `:156`.
- [ ] Claim the card outside `patch` at `watch.ts:98`: set `priorStatus` through `patch`, then
      await `setCardStatus`.
- [ ] Sweep `cli/src/` for any other board write started with `void` or left unawaited,
      leaving `watch.ts`'s `void finish(...)` calls as they are.
- [ ] Check that a manual-commit delivery still ends and archives its card when the user
      commits, and that a stopped and an errored run still close.

## Decided by the agent
- **Where the finished delivery is completed**: `readCard` in the Local board provider is the
  only awaited caller on the card page's read path, so it ends the delivery and awaits the
  archive, and `manualSettled` keeps only the sentence it returns.
- **Why losing that one poll is acceptable**: an auto landing already ends and completes
  outside any read (`cli/src/lib/agent/landing.ts:563`), so the card page never shows the
  finished banner for one, and a manual commit now behaves the same way.
- **Why `claimCard` is not simply awaited in place**: `patch` runs its callback inside the run
  record's file lock, so awaiting a board write there would hold that lock across it.

## Source
- #316 — the card that held this fix, and the revision-on-save half that stays there.
- #319 — the publisher that needs a settled board write to hang off.
