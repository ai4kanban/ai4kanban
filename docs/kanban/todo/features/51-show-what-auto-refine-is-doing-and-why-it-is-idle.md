---
title: Show what auto-refine is doing and why it is idle
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: [16]
modules: [local-ui]
questions:
  - "[user] The background timer only starts once a browser tab calls the server. Should this card just say that in plain words, or also fix it so the timer runs from server start?"
  - "[agent] Where does this live — inside the Configuration dialog under the switch, or as its own quiet line in the header?"
  - "[agent] Does it show only the last auto-refine and the next pick, or a short list of the recent ones?"
---

Show what the auto-refine switch is actually doing, so a user who turns it on can tell it is working and why it sometimes does nothing.

## Today
- The switch is on or off, and that is all the user sees.
- The background timer wakes once a minute, picks the highest-priority card that still needs refining, and runs one refine on it (`kanban-ui/lib/dispatcher.ts`).
- It skips a card whose every open question is `[user]`, and a card with all todos checked. When every card is in one of those states, nothing refines — correctly, but silently.
- The timer also only starts once a browser tab calls the server (`ensureDispatcher` runs from the polled server actions). With no tab open, nothing refines. Nothing tells the user this.
- So "on, and quiet" and "on, but nothing to do" and "on, but no tab open" all look the same. A user who turns it on and sees no change cannot tell which one they are in.

## Scope
- One small read-only status next to the switch, in plain words.
- What it says when the switch is on:
  - the card it is refining right now, if any;
  - the last card it refined and when;
  - the card it would pick next;
  - if it would pick nothing, the reason in one line — for example "every card is waiting on you" or "no card needs refining".
- What it says when the switch is off: one line saying nothing refines.
- Read-only. It reports; it does not start, skip, or reorder a refine.
- It reuses what is already there: the run list the UI already polls, and the dispatcher's own pick rules. No new poll loop.

## Scope out
- No queue editor. The user does not pick or reorder which card refines next.
- No history of every auto-refine ever. The runs panel already keeps runs.
- No new header control — global settings live in the Configuration dialog, per `redesign.md`.

## Note on #16
Card #16 adds an auto-implement switch to the same dialog. Write this status so a second background switch can reuse it rather than getting its own separate readout.

## Todo
- [ ] Expose the dispatcher's current state: what is running, what it last refined, what it would pick next.
- [ ] Make the "would pick nothing" case return a reason, not just an empty answer.
- [ ] Add the read-only status next to the auto-refine switch.
- [ ] Write the off state and the each-reason lines in plain words a first-time user gets in one pass.
- [ ] Keep it on the existing poll — no new timer or fetch loop.
- [ ] Update `kanban-ui/README.md` — the Auto-refine section should say what the status tells the user.
