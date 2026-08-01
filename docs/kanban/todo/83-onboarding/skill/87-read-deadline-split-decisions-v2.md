---
title: Read the deadline from goal.md and move decisions that can wait to decisions-v2.md
track: skill
priority: med
roi: med
status: todo
release: next
blocked_by: [84]
related: [83, 86]
modules: [skill]
questions:
  - "[user] If the deadline passes and v1 has not shipped, does decisions-v2.md just stay parked, or should the board say anything about it?"
---

Give setup a sense of time. It reads any deadline out of `goal.md` — setup asks for
nothing but the goal (#84) — and splits the settled calls by it. Calls about work that can
wait until after the deadline move out of `decisions.md` into `decisions-v2.md`, so
planning before the deadline reads only what v1 needs.

This is a special case — keep it simple. No merge tooling, no UI. Setup just tells the
user: when v1 ships in time, merge `decisions-v2.md` into `<module>/decisions.md` or the
global `decisions.md` by hand.

## Today
- Setup settles `decisions.md` from `goal.md` (#84) with no sense of time. A call about
  work that can wait sits next to a call that must ship, and planning treats them the
  same.
- The deadline is already part of the goal's horizon, so it is there to read. Nothing
  reads it.

## Scope
- Add the deadline to the setup flow doc (#84's `references/setup.md`), in the decisions
  step: the agent reads the horizon in `goal.md` and works out whether there is a date.
- If there is a deadline: calls about work that can wait past it go into
  `decisions-v2.md` at the board root. `decisions.md` keeps only what v1 needs.
- If the goal says nothing about time: there is no deadline, nothing changes, and no
  `decisions-v2.md` is created. Setup does not ask.
- Setup ends this step by telling the user in one line: merge `decisions-v2.md` into
  `<module>/decisions.md` or the global `decisions.md` when v1 ships in time.

## What the user sees
- A user with a deadline gets a `decisions.md` that holds only v1 calls, so the first
  cards aim at the deadline. The later ideas wait in `decisions-v2.md` instead of
  getting lost.

## Decided by the agent
- Where is the deadline itself recorded? In `goal.md` — it is part of the horizon, and
  setup reads it there rather than asking for it.
- Does #86's end-of-setup split touch `decisions-v2.md`? No. It splits only
  `decisions.md`; `decisions-v2.md` stays one file until the user merges it.

## Todo
- [ ] Add the deadline to the setup flow doc (#84's `references/setup.md`): the decisions
      step reads it from the goal's horizon, and asks for nothing.
- [ ] Write the split rule: what counts as work that can wait, that `decisions-v2.md`
      lives at the board root, and that `decisions.md` keeps only v1 calls.
- [ ] Write the one-line merge note setup leaves for the user.
- [ ] Run setup on a goal that names a deadline and check the split; run it on a goal that
      says nothing about time and check nothing is asked and no `decisions-v2.md` appears.
