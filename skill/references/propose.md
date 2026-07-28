# Propose new tasks

Pick a module, then propose **3 new tasks inside it**. New work, not picks from the
board — tasks in one focus close a gap; scattered ideas just skim the product.

## 1. Pick the module

**Ask the user to pick one or more modules from the map.** If they leave it open, pick
one yourself — the one where memory says users stumble most.

Once you have a focus module, its memory set lives at `docs/kanban/memory/<module>/` (keyed
by its bolded name in `modules.md`) — the five files described in "The memory set" in
`SKILL.md`. Read that path, not the whole board, so the notes you work from are that
module's: `readme.md` for what already shipped (links to the published docs),
`goal.md` for its direction, `decisions.md` for settled answers you needn't re-open, and
`redesign.md` / `rejected.md` to avoid wrong designs and re-proposals. For a shipped
behavior's detail, follow `readme.md`'s links into the module's **published docs** — the
docs are the record, memory only indexes them. A module with no folder yet has no notes.
With no focus module or no module map, read the project-wide set at `docs/kanban/memory/`
instead.

**List the cards already tagged with the focus module.** Grep the board for cards whose
`modules:` field names it — `grep -rl 'modules:.*<module>' docs/kanban/todo/` — and read
them, so you don't re-propose planned work and you see where the module already has effort.

## 2. Walk it as a user

Ideas come from a walkthrough, not a feature list. Play one real user story in the
focus, step by step. At each step ask: what can't they see or find? what do they wait
on, guess at, or redo by hand? Every stumble is a task idea.

Then check the focus's written sources — the code, roadmap doc, user-facing docs
(Configuration, where shipped behavior is recorded), `todo/`, `rejected.md`, and the focus
module's memory (from step 1, `readme.md` included) — to catch promised work and stop
re-proposals.

## 3. Propose 3 tasks

All inside the focus; none already on the board, already shipped (in the published docs or
`readme.md`), or in `rejected.md` (unsure one is already done? run the Value check in
`references/refine.md`). Write each
with the "Add a task" flow in `SKILL.md`.

A propose run writes no memory. `readme.md` is the finish flow's record — a scan reads
it and leaves it alone.
