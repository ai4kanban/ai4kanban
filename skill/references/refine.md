# Refine

Take one task and move it one step forward — from vague to concrete. A refine is two
substeps, always in order: **review** the card, then **rewrite** it.

**Gate: open questions block a refine.** If the card's `questions` frontmatter is not
empty, it's waiting on decisions — resolve them first (`references/resolve.md`), then
refine once the list is empty.

## 1. Review

Read the card and check these points. Don't overthink — flag real problems, not
hypotheticals.

1. **Missing steps.** Work the plan implies but never lists: a docs update, tests, a
   human review pass, a landing-copy update, and the like.
2. **Missed edge cases and unreliable designs.** Call out design mistakes the card
   glosses over. Example: a task-management backend designed to keep tasks only in
   memory loses everything on restart — that's a mistake to point out, not a detail.
   Also re-check decisions the card already states — written doesn't mean right.
3. **Goal fit.** The goal is the card's title and its "so the user can ..." line —
   not whatever the body's summary has grown into over past refines. Test each piece
   of the plan: would the goal still be met with this piece cut? If yes, it's scope
   creep — cut it or split it off. On-topic is not the test; needed for the goal is.
   The common drift: the goal names one thing ("find a run's log"), the plan builds
   the general version ("a history of all runs"). Trimming a plan back to its goal
   counts as pushing the card forward.
4. **Over-complication.** Is the design more machinery than the value justifies? Name
   what to cut.
5. **Actionability.** Is the card still a rough idea nobody could start on?
6. **Stale todos.** Check each unchecked todo against the repo — work sometimes lands
   without the box getting ticked. Note the ones that are already done.

The review's outcome is two lists:

- **Open questions** — decisions that are hard to make without the user: taste,
  priorities, money, product direction. Record them on the card with
  `${KB} update <id> --question "..."` (repeat the flag for several).
- **Revisions** — fixes you can decide yourself. Carry them into the rewrite.

## 2. Rewrite

1. **Push the card one stage forward.** Judge where it stands, then take the next
   step only — one stage, not three:
   - **A rough idea** → work out if it's worth doing and how. The user value, who
     it's for, whether we can build it. Land on a clearer shape.
   - **A decided-on feature** → design the exact user experience. What the user sees,
     each step they take, what happens on edge cases.
   - **A research or content task** → find the specific question to answer or the
     piece's structure, and what we can say that others don't.

   These are examples, not a fixed list. Read the task and decide what "one step
   forward" means for it.
2. **Apply the revisions** from the review.
3. **Refresh the todo list.** Tick off every todo the review found already done. If
   every box already matches reality, leave the list as is.
4. **Split off side ideas.** An idea that came up during the refine but isn't needed
   for the goal (the goal-fit test — on-topic doesn't count) becomes its own card
   (follow "Add a task" in `SKILL.md`, minding `references/add-task.md`'s rule
   against near-duplicate splits), not a bullet buried in this one.
5. **Write the result back into the card body**, in the plain, short language
   `references/add-task.md` uses — a reader should get each line at a glance.

**Stop at the code level.** Never push further once the plan is concrete. Don't
mention coding details — what functions to add, what files to touch. Stop when the
whole plan is easy to start.

## 3. Mark it ready (when it's done)

A refine that lands a concrete plan with no open questions has finished the card. Mark
it `ready` with `${KB} update <id> --status ready` —
only when **both** hold: the plan is concrete (this refine stopped at the code level,
not one stage short) and the `questions` list is empty, so someone could start
building now. The user scans for the `ready` pill to pick what to implement next.

If the review raised open questions, still rewrite with what you could decide, but
leave the questions on the card and don't mark it ready — the next refine is blocked
until they're resolved. (Recording a question with `update <id> --question` on a card
that was already `ready` drops it back to `todo` on its own.)

## Group tasks

A **group task** is a root card plus its subtask cards in one folder (see "Group task"
in `SKILL.md`). Root and subtasks are one plan split across files, so refining the
`root.md` ripples into them.

After you rewrite the root, bring its subtasks in line with the new plan:

- Re-read each subtask card. Refine the ones the change touched so their scope, order,
  and blocked-by links still match the root.
- Drop a subtask the plan no longer needs (reject it); add a card for a new piece it
  now needs (the "Add a task" flow in `SKILL.md`).
- Keep the root's subtask list and the real subtask cards in sync.
