---
title: Schedule a blocked card so it starts the moment its blocker is done
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: [16]
modules: [local-ui, skill]
questions: []
---

Let a user queue up a card that is ready but waiting on another card. The card shows
`pending` instead of `ready`, and its run starts on its own as soon as the card it waits
on leaves the board.

Today a ready card blocked by an open card just sits there. The user has to remember it,
come back after the blocker is finished, and click Implement. That wait is the machine's
job, not the user's.

## Scope
- A ready card with an open blocker gets a Schedule button. Clicking it queues the card.
  A card that is not ready gets no button — rough plans and open questions are refined
  and resolved first, as they are today.
- Being scheduled is a mark of its own, not a new status. The card stays `ready`;
  `pending` is what the pill reads while the mark is on.
- A queued card shows `pending` in place of the `ready` pill, on the board and on its
  page. Hovering says what it is waiting for — the ids of the cards ahead of it.
- The card stays in the ready half of the queue view — it is vetted work, just not
  startable yet.
- Clicking again unschedules it. The card goes back to plain `ready` and nothing fires.
- When every card it waits on has left the board, the server starts the run by itself,
  within a minute. Archived and rejected count the same: either way that card is gone and
  holds nothing up.
- The run is the plain Implement the button starts — no refine leg. It lands in the runs
  panel like any other run, and Stop works on it.
- Scheduling one card is the whole opt-in. It does not read the auto-implement switch
  (#16) and does not wait for it: one click queues one card, one run fires. Nothing here
  walks the board picking cards on its own.
- The mark clears the moment the run starts. A run that fails or is stopped does not fire
  again — the card is plain `ready` and the user starts it by hand.
- A scheduled run does not take an auto-refine slot, and at most one starts per tick. A
  refine in progress must not hold back a card whose blocker just cleared.
- The mark survives a server restart, so it lives in the card's frontmatter and the
  script writes it.
- A card whose blocker never gets finished stays pending forever. That is fine — it costs
  nothing and the user can unschedule it.

## Todo
- [ ] Add the field that says a card is scheduled, written by `kanban create`/`update`
      and kept through both frontmatter serializers (script and UI). The status stays
      `ready`.
- [ ] Refuse to schedule a card that is not ready, or that has no open blocker.
- [ ] Add the Schedule / Unschedule button to the card page.
- [ ] Show `pending` in place of `ready` on a scheduled card, with the blocker ids on
      hover.
- [ ] Teach the dispatcher to start the run once a scheduled card's blockers are all
      gone, and clear the mark when it does.
- [ ] Give scheduled runs their own slot: one start per tick, separate from the
      auto-refine slots.
- [ ] Update `kanban-ui/README.md` and the daily-loop guide.
- [ ] Make two cards, block one on the other, schedule it, archive the blocker, and watch
      the run start on its own.

## Decided by the agent
- **Implement straight away, or refine first?** — Implement. Only a ready card can be
  scheduled, and a refine leaves a ready card exactly as it was (`canRefine` in
  `kanban-ui/lib/refine.ts`, which is also why the card page hides Refine there).
- **Does a rejected blocker fire the card too?** — Yes, the same as an archived one. The
  board already clears a block as soon as the blocker's id is off the board, however it
  left (`attachBlockers` in `kanban-ui/lib/board.ts`), and that one list draws the Blocked
  chip and the dispatcher's skip.
- **Is `pending` a new status?** — No. The statuses are the fixed three, `todo` / `ready` /
  `implementing`, in the script and the UI alike, and the queue view groups by them — a
  fourth would drop the card out of the ready half. Scheduling gets its own field, the way
  a cadence does on #139.
- **Does the run need the auto-implement switch (#16)?** — No, and it does not wait for
  that card. #139 settled the same shape: a per-card opt-in is its own switch, and the
  global one stays about refining. #16 needs a stop rule because it picks card after card;
  this fires one run for one card the user picked, and the mark clears when it starts.
- **Can a rough card be scheduled?** — No, ready only. `ready` already means a concrete
  plan and no open questions — the script pushes a card with open questions back to `todo`
  — so anything else would queue an implement on a plan nobody settled.
