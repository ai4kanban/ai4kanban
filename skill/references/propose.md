# Propose new tasks

Pick a module, then propose **3 new tasks inside it**. New work, not picks from the
board — tasks in one focus close a gap; scattered ideas just skim the product.

**Stop if setup is unfinished** — `docs/kanban/setup-checklist.md` being there says it is.
Propose nothing; follow `references/setup.md` instead.

## 1. Pick the module

**Ask the user to pick one or more modules from the map.** If they leave it open, pick
one yourself — the one where memory says users stumble most.

Once you have a focus module, its memory set lives at `docs/kanban/memory/<module>/` (keyed
by its bolded name in `modules.md`) — the four files described in "The memory set" in
`SKILL.md`. Read that path, not the whole board, so the notes you work from are that
module's: `readme.md` for what already shipped (links to the published docs),
`decisions.md` for settled answers you needn't re-open, and
`redesign.md` / `rejected.md` to avoid wrong designs and re-proposals. For the long-term
goal, the horizon, and the roadmap, read `docs/kanban/memory/goal.md` — the board root's
copy is the only one, and it covers the whole project, not this module. While it's
open, re-judge its `reviewed:` field and fix a stale value by editing that one line
(the test is under "The memory set" in `SKILL.md`). For a shipped
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

### Boldness

How big a move each of the 3 is. Whoever asks for the run picks one; **normal** unless
they say otherwise. It changes the size of the idea, never the count — 3 either way.

- **safe** — polish a rough edge, or fill a gap in something that already works. No new
  surface: the user's story is the one they play today, just without the stumble.
- **normal** — a feature each: one card a session can finish. The default size.
- **bold** — a big leap each: a whole new capability for the module, something the user
  can't do today at all. Judge it against the long-term goal in
  `docs/kanban/memory/goal.md`, not against the current rough edges — a bold task is a
  step toward the horizon. A task this big is normally broad enough to split into
  subtasks that need splitting again, so write it as a **group task** (see "Group task"
  in `SKILL.md`); write it as one card only if the split truly doesn't earn its folder.

Boldness is a size, not a licence: a bold task still has to be new (not on the board, not
shipped, not in `rejected.md`) and still gets written with the "Add a task" flow.

A propose run writes no memory. `readme.md` is the finish flow's record — a scan reads
it and leaves it alone.
