---
title: Ask for a deadline in setup and move decisions that can wait to decisions-v2.md
track: skill
priority: med
roi: med
status: todo
blocked_by: [84]
related: [83, 86]
modules: [skill]
questions:
  - "[user] If the deadline passes and v1 has not shipped, does decisions-v2.md just stay parked, or should the board say anything about it?"
---

Add one question to the setup conversation: is there a deadline for this work? If there
is, split the settled calls by time. Calls about work that can wait until after the
deadline move out of `decisions.md` into `decisions-v2.md`, so planning before the
deadline reads only what v1 needs.

This is a special case — keep it simple. No merge tooling, no UI. Setup just tells the
user: when v1 ships in time, merge `decisions-v2.md` into `<module>/decisions.md` or the
global `decisions.md` by hand.

## Today
- Setup settles `decisions.md` from `goal.md` (#84) with no sense of time. A call about
  work that can wait sits next to a call that must ship, and planning treats them the
  same.

## Scope
- Add the deadline question to the setup flow doc (#84's `references/setup.md`), asked
  while the decisions are being settled.
- If there is a deadline: calls about work that can wait past it go into
  `decisions-v2.md` at the board root. `decisions.md` keeps only what v1 needs.
- If there is no deadline: nothing changes, and no `decisions-v2.md` is created.
- Setup ends this step by telling the user in one line: merge `decisions-v2.md` into
  `<module>/decisions.md` or the global `decisions.md` when v1 ships in time.

## What the user sees
- A user with a deadline gets a `decisions.md` that holds only v1 calls, so the first
  cards aim at the deadline. The later ideas wait in `decisions-v2.md` instead of
  getting lost.

## Decided by the agent
- Where is the deadline itself recorded? In `goal.md` — it is part of the horizon.
- Does #86's end-of-setup split touch `decisions-v2.md`? No. It splits only
  `decisions.md`; `decisions-v2.md` stays one file until the user merges it.

## Todo
- [ ] Add the deadline question to the setup flow doc (#84's `references/setup.md`).
- [ ] Write the split rule: what counts as work that can wait, that `decisions-v2.md`
      lives at the board root, and that `decisions.md` keeps only v1 calls.
- [ ] Write the one-line merge note setup leaves for the user.
- [ ] Run setup with a deadline and check the split; run without one and check no
      `decisions-v2.md` appears.
