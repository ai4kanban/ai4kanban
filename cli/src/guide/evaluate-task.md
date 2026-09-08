# Evaluate a task

Run this once for every task idea before creating its card. A revision repeats only the
checks affected when it materially changes the task's outcome. Reuse sources already read
earlier in the same flow.

1. **Resolve the modules.** Read `docs/kanban/modules.md` and relevant code or plans to choose
   modules or verify supplied tags. Follow `akb guide module-map` if no module fits or an
   existing module now contains independently developed parts. Never ask the user to categorize the task.
2. **State the need.** Identify the observable result and the current behavior or constraint
   it changes. If either is unclear, the idea is not ready to become a card.
3. **Check direction and evidence.** Read `docs/kanban/memory/goal.md`, the resolved modules'
   memory, and relevant sources. If the goal is missing, empty, unchanged from the template
   or unreadable, use memory and repository context to assess value and feasibility.
   Assess the idea independently if neither provides guidance. Never ask the user to write
   a goal. If value or feasibility remains unclear, or evidence rules the idea out, stop
   and explain before creating a card.
4. **Check existing work once.** Search the relevant code and docs, then run
   `akb raw list --module <module>` for each resolved module. Skip work already supported
   or rejected. Update the card that already owns planned work when the idea is a tweak,
   reframe, or extra detail; create a new card only for a separate deliverable.

Pass each surviving idea to `akb guide add-task`. Do not repeat this evaluation during
ordinary refinement.
