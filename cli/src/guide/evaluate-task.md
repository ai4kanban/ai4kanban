# Evaluate a task

Run this once for every task idea before creating its card. A revision repeats only the
checks affected when it materially changes the task's outcome. Reuse sources already read
earlier in the same flow.

1. **Resolve the modules.** If none were supplied, read `docs/kanban/modules.md` and infer
   them. Never ask the user to categorize the task. If no module fits, repair the map with
   `akb guide module-map`.
2. **State the need.** Identify the observable result and the current behavior or constraint
   it changes. If either is unclear, the idea is not ready to become a card.
3. **Check direction and evidence.** Read `docs/kanban/memory/goal.md`, the resolved modules'
   memory, and the relevant project sources. An empty goal — no file, seed text only, or
   unreadable frontmatter — is never a reason to stop: take direction from the modules'
   memory and the repository itself (README, package files, layout), and judge the idea on
   its own feasibility when those say nothing either. Never ask the user to write a goal.
   Stop when the idea has unclear value or feasibility, or when what you did read rules it
   out; explain the concern before creating anything.
4. **Check existing work once.** Search the relevant code and docs, then run
   `akb raw list --module <module>` for each resolved module. Skip work already supported
   or rejected. Update the card that already owns planned work when the idea is a tweak,
   reframe, or extra detail; create a new card only for a separate deliverable.

Pass each surviving idea to `akb guide add-task`. Do not repeat this evaluation during
ordinary refinement.
