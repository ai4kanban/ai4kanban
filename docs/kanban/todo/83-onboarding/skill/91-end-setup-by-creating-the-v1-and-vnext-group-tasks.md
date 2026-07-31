---
title: End setup by creating the v1 and vnext group tasks
track: skill
priority: high
roi: high
status: todo
blocked_by: [86]
related: [83, 100]
modules: [skill]
questions:
  - "[user] Does setup already split the ideas between v1 and vnext, or does it put everything in vnext and leave the split to the first planning round? (a) Setup proposes the split and the user corrects it. (b) Everything starts in vnext and the user pulls work into v1 later. Recommend (a): a board where every idea sits in vnext looks the same as a board with no plan."
---

Setup's last step creates two group tasks instead of ten loose cards: **v1**, what the
first release must include, and **vnext**, everything else worth doing. The user then
plans inside them.

## Today
- The closing step of setup (#86) ends by creating the first 10 tasks from the goal, the
  decisions, and the fresh module map.
- Ten cards side by side say nothing about order. Which of them make the first release,
  and which can wait, is a sort the user has to do by hand on their first day.
- Anything the setup conversation raised that didn't make the ten is gone.

## Scope
- Setup's last step creates two group tasks:
  - **v1** — the first release. Its root card says what v1 must include, read from
    `goal.md`, the decisions, and the module map. Its subtasks are the work that ships
    it.
  - **vnext** — everything else. Its root card holds one line per idea; its subtasks stay
    coarse until they move.
- Every idea setup surfaced lands in one of the two. Nothing is dropped for missing v1.
- Keep v1 small: the first thing the user can show someone, not the whole goal.
- Write down how later releases work: planning v2 is moving a slice out of vnext into a
  new **v2** group task, and what is left stays in vnext. The same move repeats for v3.
  A release is a slice off vnext, never a fresh guess.
- This is the last box on the setup checklist (#85). Ticking it is what ends setup and
  drops the setup bar.

## What the user sees
- Setup ends with a board that already has a shape: one group task holding the first
  release, one holding everything after it — instead of a flat pile of cards with no
  order.

## Decided by the agent
- Are the two group tasks always created, even for a tiny project? Yes. Two roots are the
  shape of the board; a tiny project just gets a short v1 and a near-empty vnext.
- Does this card build the vnext → v2 slice? No. It writes the rule down so the board
  follows it; a flow that does the slice with buttons is separate work.

## Todo
- [ ] Replace the "create the first 10 tasks" ending in the setup flow doc (#84's
      `references/setup.md`) with the v1 / vnext step.
- [ ] Write what goes in the v1 root: what the first release must include, and how small
      it should stay.
- [ ] Write what goes in the vnext root: one line per idea setup surfaced but v1 does not
      need.
- [ ] Write the release rule: a later release is a slice moved out of vnext into its own
      group task, and the rest stays in vnext.
- [ ] Point the checklist's last box (#85) at this step instead of the ten cards.
- [ ] Run setup on a fresh repo and check the board comes out with exactly two group
      tasks, a v1 the user agrees is the first release, and every other idea in vnext.
