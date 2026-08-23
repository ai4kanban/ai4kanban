---
title: Make one Implement click carry a card all the way to landed
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [302, 304]
related: [300]
modules: [local-ui, skill]
questions: []
---

The pieces exist by now but nothing joins them: a click still means implement, and the user
drives the rest. Make one click on a card with no open questions run implementation, review,
corrections, landing and completion, pausing only for a failed check or a decision only a person
can make. Say clearly what the user is approving, and cap how much can be in flight at once.

## Worth noting
- One click and the change is on the target branch. Nothing asks you again in between.
- What you approve is the card, not the diff: what it should achieve, what to weigh, its open
  questions, and what turned up while it was built. A board that wants diff approval turns that
  on separately.
- Manual commit mode is the one exception: the flow stops after review and waits for you.
- A card that pauses is waiting on something specific — an unresolved question, a pending
  approval, or manual mode. It says which.

<!-- agent -->

## Scope
- **One click, all the way**: once a card's open questions are resolved, one click runs
  implementation, review, corrections, landing and completion.
- The flow pauses only for a failed check or a human decision.
- **The four parts a human reviews** are shown together as what approval means: the task summary
  (what the task should achieve), worth noting (context that needs no decision), open questions
  (decisions needed before implementation or landing), and worth noting after implementation
  (non-blocking context found while building or reviewing).
- **Manual commit mode** stops after review and waits for the user's commit, as #303 defines.
- **Waiting UI**: after review in manual mode, CardPage shows **Waiting for your commit**, the
  reviewed diff, and "Commit these changes in your editor or terminal, then return here."
- Detect the new commit and compare it with the reviewed snapshot. When they differ, show **Code
  changed after review** and review again.
- **Each click starts one run**, and several cards may have active runs at the same time. Landing
  is already serialized by #304's queue.
- **The same flow in the command**, so a board driven from a terminal gets the same behaviour as
  one driven from the app.
- **Pause states are derived**, not stored — from unresolved questions, pending approval, or
  manual mode. The card page says which one it is waiting on.

## Todo
- [ ] Join implementation, review, correction, landing and completion into one action behind the
      Implement click.
- [ ] Pause only on a failed check or a decision for the human, and say on the card which one.
- [ ] Show the four parts a human approves together on the card page, so approval means one
      thing.
- [ ] Stop after review in manual commit mode and show **Waiting for your commit** with the
      reviewed diff.
- [ ] Detect the user's commit, compare it with the reviewed snapshot, and show **Code changed
      after review** plus a fresh review when it differs.
- [ ] Give the command the same one-click flow the app has.
- [ ] Derive the pause state from unresolved questions, pending approval or manual mode rather
      than storing it.
- [ ] Update `kanban-ui/README.md` and the daily-loop guide — what one click now does.

## Source
- `plan.md`, in commit `1127a91` — "What the human reviews", "Core workflow" (one-click flow),
  "Commit permission" (waiting UI).
