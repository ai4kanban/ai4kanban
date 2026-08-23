---
title: Update the sibling tasks when one task's plan changes
track: skill
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: []
modules: [skill]
questions: []
---

When one card in a group settles something the other cards were built on, those cards keep
their old plan and quietly go wrong. Let the board fix them right after the change.

## Scope
- It runs at the end of resolve and refine (auto-refine included), whenever the flow
  changed the card's plan — the summary line, `## Scope`, or `## Todo`. A change to only
  priority, roi, release, status, or a ticked box moves no plan and starts nothing.
- No new command, no switch, no timer. It is the last step of the flow that made the
  change, so the user never has to ask for it.
- The change reaches one hop: if the card sits in a group folder, the root and the other
  subtasks there; plus the open cards it names in `related` or `blocked_by`, and the open
  cards that name it. A card rewritten this way starts no round of its own, so one change
  never rolls across the board.
- The flow reads each card it reached and keeps only the ones the change actually
  contradicts. A card whose plan still holds is left alone.
- Each affected card goes to its own subagent with a fresh context, one card at a time,
  the same way auto-refine hands out questions.
- The subagent edits only the lines the change contradicts. This is not a refine: it never
  marks a card ready and never ticks a box.
- A card it rewrote goes back to `todo`. The plan moved, so it is read again before it is
  built.
- A card being built right now (`implementing`) is never rewritten. The drift is left on it
  as an open question instead.
- Never silently undo a user's own words. A rewrite that would drop something the user
  wrote becomes an open question on that card instead.
- Only a plan-stage change spreads. Finishing a card starts nothing — what shipped is
  already recorded in `readme.md`, and each card's own refine checks what is built.
- Say what changed in each card it rewrote, so the user can see the knock-on edits and
  overrule them.

## Todo
- [ ] Write down what counts as a plan change worth spreading, and what does not.
- [ ] Add the flow as a reference doc in the skill, and point resolve and refine at it as
      their last step.
- [ ] Work out which cards a change reaches — the group's root and other subtasks, plus the
      cards linked by `related` or `blocked_by` either way, one hop only.
- [ ] Read each reached card first and drop the ones the change does not contradict.
- [ ] Spawn one subagent per affected card, with a fresh context, to make the narrow edit.
- [ ] Set a card that was rewritten back to `todo` with the script.
- [ ] Leave a question instead of rewriting when the card is being built, when the rewrite
      would drop the user's own wording, or when the call is only the user's to make.
- [ ] Report what was changed in which cards at the end of the run.
- [ ] Say in `docs/guides/daily-loop.md` that answering a question on one card can rewrite
      the cards around it, and how to spot and undo those edits.
- [ ] Try it end to end: take a group task, answer a question on one subtask that changes
      the shared design, and check the other subtasks come out right.

## Decided by the agent
- **What starts the flow?** A resolve or refine that changed a card's plan text. A
  frontmatter-only edit or a ticked box starts nothing.
- **Does it run on its own?** Yes — as the last step of the flow that made the change. No
  new command, no UI switch, no background timer of its own.
- **Which cards does a change reach?** One hop: the group folder's root and sibling
  subtasks, plus the open cards linked by `related` or `blocked_by` in either direction. A
  rewritten card does not spread the change further.
- **How much may the subagent change?** Only the lines the change contradicts. It is not a
  refine — it never marks a card ready and never ticks a box.
- **May it touch a card marked `ready`?** Yes, that is the whole point. Any card it rewrites
  drops back to `todo`, so a moved plan is read again before it is built.
- **May it touch a card being built?** No. A card with status `implementing` gets an open
  question about the drift instead of a rewrite.
- **Does a finished card start it?** No — plan-stage changes only. What shipped is recorded
  in `readme.md`, and a sibling's own refine already checks what is built.
