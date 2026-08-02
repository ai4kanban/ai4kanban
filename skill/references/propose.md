# Propose new tasks

Propose **new tasks inside one module** — new work, not picks from the board; tasks in
one focus close a gap, scattered ideas just skim the product.

- **Count:** the user says how many; **3** if they don't.
- **Setup unfinished** (`docs/kanban/setup-checklist.md` exists)? Propose nothing —
  follow `references/setup.md` instead.

## 1. Pick the module

- **Ask the user to pick one or more modules from the map.** Left open, pick the one
  where memory says users stumble most.
- Read its memory set at `docs/kanban/memory/<module>/` (see "The memory set" in
  `SKILL.md`) and `docs/kanban/memory/goal.md` for the direction.
- Run `${KB} list --module <module>` — every open card tagged with the focus module, so
  you don't re-propose planned work.

## 2. Write the tasks

Write each with the "Add a task" flow in `SKILL.md`. Every proposal:

- **Inside the module(s).**
- **From a user walkthrough (optional)** — play one real user story in the focus, step by
  step; every stumble (can't see, waits on, guesses at, redoes by hand) is a task idea.
- **New** — not on the board, not shipped (published docs or `readme.md`), not in
  `rejected.md`.
- **Short-term**
  - Low-hanging fruit
  - or foundational features of a broad task.
    In this case, create a group task describing the whole plan + one subtask covering the short-term goal.
    Don't waste efforts detailing the mid/long-term goal.
- **Sized by boldness** — the user picks the level; **normal** if they don't.
  It decides between low-hanging fruit and foundational features:
  - **safe** — polish a rough edge, fill a gap, or pick a low-hanging fruit. No new surface.
  - **normal** — a feature each: one card a session can finish. The default.
  - **bold** — a capability the module doesn't have at all — often a foundational v0 that
    future versions grow from. Still one card, still short-term.

A propose run writes no memory. `readme.md` is the finish flow's record — a scan reads
it and leaves it alone.
