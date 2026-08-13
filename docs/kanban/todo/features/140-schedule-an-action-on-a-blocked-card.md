---
title: Schedule an action on a blocked card so it runs when the blocker is done
track: features
priority: med
roi: med
status: ready
release: "0.6.0"
blocked_by: []
related: [16]
modules: [local-ui, skill]
questions: []
---

A card waiting on another card can only be built by clicking **Implement anyway**. Give it
a second way out: schedule the action, and the board runs it by itself the moment the
blocker is done.

Today the user has to remember the card, come back after the blocker is finished, and click
again. That wait is the machine's job, not the user's.

## Scope
- Scheduling is never an action of its own — it always follows one. The two are
  **Schedule implement** and **Schedule refine**.
- It shows wherever a card has an open blocker. The blocked warning box that today only
  offers "Implement anyway" gets **Schedule** beside it, and the refine dialog — which
  today names the blocker and refines anyway — gets the same. Schedule is the plain path:
  no "I know" tick, because nothing starts ahead of the blocker. "Anyway" stays the risky
  one it is today.
- The not-ready warning is unchanged. Scheduling an implement on a rough card still needs
  its "I know the plan may still be rough" tick, the same as building it now.
- A card holds one schedule at a time. Scheduling a second action replaces the first, and
  the dialog says which one is on.
- Notes typed in the dialog ride along with the schedule and reach the run when it fires.
- Being scheduled is a mark of its own, not a new status. The card keeps its status;
  `pending` is what the pill reads while the mark is on.
- A scheduled card shows `pending` in place of its status pill, on the board and on its
  page. Hovering says what will run and what it waits for — "implement · waiting on #57".
- The card stays where it is in the queue view. It is the same card, just not startable yet.
- The card page has one control that takes the schedule off. Nothing fires after that.
- When every card it waits on has left the board, the server starts the run by itself,
  within a minute. Archived and rejected count the same: either way that card is gone and
  holds nothing up.
- The mark clears the moment the run starts. A run that fails or is stopped does not fire
  again — the card is plain again and the user starts it by hand.
- If the action would no longer do anything by the time the blocker clears — a scheduled
  refine on a card someone already took to `ready` — the mark is dropped and no run starts.
- A scheduled run does not take an auto-refine slot, and at most one starts per tick. A
  refine in progress must not hold back a card whose blocker just cleared.
- A scheduled refine does not need the auto-refine switch on. One click queued one run; the
  switch is about the board picking cards nobody asked for.
- A card whose blocker never gets finished stays pending forever. That is fine — it costs
  nothing and the user can take the schedule off.

## Where a schedule is kept
The schedule belongs to the card, so it lives in that card's own frontmatter and only `akb`
writes it — the same path every other meta field takes.

- **It survives everything**: a server restart, a reboot, a `git clone` on another machine.
  There is nothing in memory to lose.
- **It travels with the card**: moving the card to another track or into a group folder
  keeps it, and archiving or rejecting the card takes it away with the file.
- **Nothing can drift**: a separate list of schedules would have to be kept in step with a
  board that people also edit by hand and in git.

One field, holding the action and the notes:

```
schedule:
  action: implement
  notes: "..."
```

The CLI and the UI both read and write frontmatter, so both have to keep this field —
neither may drop it when it rewrites a card.

## Todo
- [ ] Keep a card's scheduled action and notes in its frontmatter, written by `akb`, and
      carried through both frontmatter readers and writers.
- [ ] Offer Schedule beside "anyway" in the implement and refine dialogs of a blocked card,
      and refuse a schedule on a card with no open blocker.
- [ ] Show `pending` in place of the status pill on a scheduled card, saying what will run
      and what it waits for.
- [ ] Add the control that takes a schedule off.
- [ ] Start the scheduled action once the last blocker leaves the board and clear the mark
      when it does — dropping it instead when the action would no longer do anything.
- [ ] Give scheduled runs their own slot: one start per tick, separate from the auto-refine
      slots.
- [ ] Update `kanban-ui/README.md` and `docs/guides/daily-loop.md`.
- [ ] Make two cards, block one on the other, schedule an implement on one and a refine on
      another, archive the blocker, and watch each run start on its own.

## Decided by the agent
- **Which actions can be scheduled?** — Implement and refine, the two the board runs on a
  one-shot card. Resolve is out: it stops for the user's answers, so a run nobody is
  watching would only sit there. A recurring card's Run is out too — it is never blocked,
  and its cadence is already its schedule.
- **Can a rough card be scheduled?** — Yes. Refining a blocked card is wasted work — its
  plan rests on work that could still change shape, which is why the dispatcher skips it
  (#89) — and scheduling the refine is exactly the fix. A rough card can also be scheduled
  for implement; that is the same call as "Implement anyway", so it keeps the same tick.
- **One schedule per card, or a chain (refine, then build)?** — One. Building a card the
  moment it turns ready is a different feature, and #16 already owns it.
- **Is `pending` a new status?** — No. The statuses are the fixed three, `todo` / `ready` /
  `implementing`, in the CLI and the UI alike, and the queue view groups by them — a fourth
  would move the card out of its half. Scheduling gets its own field, the way a recurring
  card's cadence does.
- **Does a rejected blocker fire the card too?** — Yes, the same as an archived one. The
  board already clears a block as soon as the blocker's id is off the board, however it
  left, and that one list draws the Blocked chip and the dispatcher's skip.
- **Does the run need the auto-implement switch (#16)?** — No, and it does not wait for
  that card. The recurring cadence settled the same shape: a per-card opt-in is its own
  switch, and the global one stays about refining. #16 needs a stop rule because it picks
  card after card; this fires one run for one card the user picked.
- **"Schedule" already means a recurring card's cadence — reuse the word?** — Yes. The user
  named the feature, and the two never meet on one card: a recurring card is never blocked,
  and a one-shot card has no cadence.
