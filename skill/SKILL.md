---
name: kanban
description: Use to propose new tasks, add a task, mark one done, or push a task one step forward. Manages the file-based task board in docs/kanban/ — blockers, roadmap tracks, archive, and global task ids. Triggers on "propose new tasks", "what's on the backlog", "add a task", "this is done", "refine", "resolve", "dive deeper".
argument-hint: "[propose | add <task> | refine <id> | resolve <id> | done <id> | reject <id>]"
---

The task board lives in `docs/kanban/`. Read it before suggesting or adding work.

## Configuration

**Read `docs/kanban/config.md` first** — it carries your project's settings: name, tracks,
planning sources, reference docs, optional preset. `kanban init` seeds it; install fills it
in; until then its defaults apply. It lives with your board, so an update leaves it
untouched — the skill folder (`SKILL.md`, `kanban.mjs`, `references/`) is upstream-owned and
overwritten wholesale (see "Updating the skill"). "Your tracks / planning sources / reference
docs" below mean this file.

If `docs/kanban/config.md` is missing but a filled `config.md` sits in this skill folder
(from an older install where the config lived there), move it to `docs/kanban/config.md`
once, then continue — the skill folder now ships only a blank template.

## Writing style

Write every card in simple, clear, short language — say what to do and why it matters.
No jargon, no business-speak, no clever phrasing. A non-native reader skimming should
get it in one pass.

- Bad: "Price it as a monthly retainer for an outcome stream."
- Good: "Charge $300/month. The user gets a brief each week and a report each month."

## Layout

```
docs/kanban/
├── todo/           open tasks
│   ├── README.md   the index — read it first
│   ├── blockers/   hard blockers; they gate the next milestone — clear them first
│   ├── <track>/    one folder per track (see Configuration), one card per file
│   └── recurring/  jobs on a cadence (see "Recurring task") — never archived
├── readme.md, goal.md, decisions.md, rejected.md, redesign.md
│                   the five-file memory set, umbrella copy — see "The memory set"
├── memory/<module>/  a module's own copy of the set — see "The memory set"
├── modules.md      one line per module — install writes it, propose reads it (see "The
│                   module map")
├── config.md       your project's settings (see Configuration) — seeded by init, yours to fill
├── next-id         the next free task id — NEVER edit by hand; only the script writes it
└── metrics.csv     one row per day: completed, created, rejected — script-kept; never touch
```

Before proposing, read the published docs (your reference docs), `readme.md`, and
`rejected.md` so you don't re-suggest shipped or rejected work — `readme.md` indexes what
shipped and the published docs carry the detail; there is no separate archive. Before writing
or reviewing a card, read `redesign.md` so a new card doesn't repeat a wrong plan.

## The script

`kanban.mjs`, in this skill's folder, is the **only** sanctioned way to scaffold the board,
create, update, migrate, archive, or reject a task. It allocates ids, writes a card's
**frontmatter**, moves/removes task files, keeps the README index, and records the daily
metric. Point `KB` at it using this skill's base folder — the path the harness gives you
when the skill loads (a copied install is `.claude/skills/kanban/`; a plugin install is the
plugin's read-only cache), e.g. `KB="node .claude/skills/kanban/kanban.mjs"`. Set it once
and run every command from the repo root as `${KB} <command>`:

```
${KB} init [track...]               # scaffold docs/kanban/ (tracks default to feature bug research)
                                    # re-run to repair an older board: adds missing config.md, modules.md, memory paths
${KB} create [--count N]            # allocate N ids (default 1), prints them
${KB} create --title ".." --track <track> [--priority high|med|low] [--roi high|med|low] \
             [--blocked-by 1,2] [--related 3] [--modules skill,site] [--question ".."] [--slug ..]
                                    # scaffold ONE card: frontmatter + body template + README entry; then fill only the body
${KB} update <id> [--priority ..] [--roi ..] [--track ..] [--slug ..] \
             [--blocked-by ..] [--related ..] [--modules ..] [--question ..] [--clear-questions]
                                    # rewrite a card's frontmatter; --track moves it, --slug renames
${KB} archive <id>                  # finish task <id>
${KB} reject  <id>                  # reject task <id>
${KB} run     <id>                  # record one run of recurring task <id> (card kept)
${KB} peek                          # current next-id, no bump
${KB} help                          # full usage
```

The script validates every value — unknown track, bad priority/roi, invented `#id`, or a
mistyped flag are hard errors, so a hallucinated field can't slip into a card.

**Never hand-write a card's frontmatter.** Use `create`/`update` for the meta
(title, track, priority, roi, blocked_by, related, modules, questions); use Write/Edit only
for the card **body** (summary, scope, todos).

A track says *what kind of effort* a task is; `modules` says *what part of the product* it
touches. Tag a card with `--modules` (comma-separated names from `docs/kanban/modules.md`);
optional — a task can touch two modules or none. An unknown name is a hard error listing
the known names — add a line to `modules.md` first, so a new part of the project gets on
the map the moment someone works on it.

## Task id

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only the script's `create` allocates them.

## Propose new tasks

When the user asks to propose work, pick **one focus area** and propose **3 new tasks
inside it** — work nobody has planned yet. Full guide in `references/propose.md`.

## Add a task

Add a task from an idea. Full guide in `references/add-task.md`.

## Review a task

Follow `references/task-review.md`.

## Refine

Take one task and move it one step forward — from vague to concrete. A card with
unresolved `questions` in its frontmatter can't be refined — resolve them first. Full
guide in `references/refine.md`.

## Resolve open questions

When a card carries open `questions`, resolving them is the only way to move it forward.
Full guide in `references/resolve.md`.

## Auto-refine

Loop refining a task until all questions answerable by agent itself are resolved. Full guide in `references/auto-refine.md`.

## Group task

Most tasks are one file. A **group task** is a broad task whose split yields subtasks that
*themselves* need splitting — a dividable of a dividable. It lives in its own folder:

```
todo/<id>-<short-slug>/
  root.md                            # the tracking task
  <track>/<subid>-<slug>.md          # a subtask, its own card, under any track folder
```

The root and each subtask take their own ids — allocate them together with
`${KB} create --count <N>`. Wire them up with the script's flags: each subtask is
**Related** to the root, and **Blocked by** between subtasks that must run in order.

## Finish a task

One-shot tasks only — a recurring card is never finished this way. (See "## Recurring task").

Record what shipped as one line in `readme.md` — the copy of the module the card names,
else the board-root copy (see "The memory set"):

1. **Only user-facing behavior.** If the change is internal-only (nothing a user can see
   or do), record nothing — don't keep an internal note.
2. **A published doc covers it → the line is a link to that doc's path.** The doc carries
   the detail (if the card has todos about "Document a change" — make sure they're done);
   `readme.md` just points at it. Don't restate what the doc says.
3. **No published doc yet → a short line in plain words** — what the user can now do, no
   task ids, file names, or other code detail. Replace it with a link once a doc covers
   the behavior.

Then run `${KB} archive <id>` — it removes the card file (or the whole folder for a group
root), strips its README entry, and records the completion.

## Reject an idea

Rejecting is rare. When you (or the user) turn down an idea, add a short line to
`rejected.md` — the copy of the module the idea's card names, else the board-root copy
(see "The memory set") — under the topic that fits; start a new topic heading if none
fits. Format: `- **<idea name>** — <why we said no, one line>.`

If the idea already had a card, run `${KB} reject <id>` — it removes the card file (or
folder), strips its README entry, and records the rejection.

## Record a redesign

When the user corrects a card that missed a requirement or got the design wrong, add a
short entry to `redesign.md` — the copy of the module the card names, else the board-root
copy (see "The memory set") — under the topic that fits; start a new topic heading if
none fits. This is a guide for the next card, not a record of the fix — say what to do
right, not what went wrong. Format:
`- ❌ **<mistake>** → ✅ <what the design should be instead, one line>.`

## The tracks

A track is the bucket a task lives in — one folder per track under `todo/`. Your tracks are listed in `docs/kanban/config.md` (Configuration), set during install.

## Recurring task

A **recurring task** is a job we repeat on a cadence (e.g. a weekly report), not a
one-shot. Its card lives in `todo/recurring/`, sets `track: recurring`, and carries two
extra sections:

- `## Process` — the distilled, in-order steps of one run. Tag each step by how it runs
  today: `[script]` a command, `[agent]` an instruction the agent follows, `[ask]` a step
  that still needs the user. The point is to move steps up the ladder over time
  (`[ask]` → `[agent]` → `[script]`) until a run needs no human.
- `## Runs` — points to the per-run open-questions files (below).

**Finishing a run** (not the whole task):

1. Run the job by following `## Process`.
2. Record it: `${KB} run <id>` — adds +1 to `completed` and **keeps the card** (no
   archive, no README change). It refuses if the card isn't under `todo/recurring/`.
3. **Self-improve.** Rewrite `## Process` from what happened so the next run needs less
   human effort: turn a manual step into an `[agent]` instruction, or an `[agent]` step
   into a `[script]` step with a real command.
4. **Log what still needed a human.** For any step the agent couldn't do alone, ask the
   user and save the answers in `todo/recurring/<id>-<slug>/runs/<YYYY-MM-DD>-open-questions.md`.
   Before the next run, fold answered questions back into `## Process` and delete them; a
   run file that empties out means that step is now automatic.

Full guide in `references/recurring-task.md`.

## Run the board locally

Optional: a small local UI to drive the board from buttons instead of the terminal. Run
it from your repo root with `npx ai4kanban-ui` (localhost only). Full guide in
`references/local-ui.md`.

## Updating the skill and local UI

Pulling a newer version into an installed project: `references/update.md`.

## The module map

`docs/kanban/modules.md` lists what parts the project is made of — one line per module.
Install writes it, and the propose flow reads it to pick a focus area. It stays true by
one rule: whoever reads it and sees a line disagree with the repo fixes that line in the
same run. To write or rebuild it, follow `references/module-map.md`.

## The memory set

The project's memory is a **fixed set of five files**:

- **`readme.md`** — shipped user-facing work, one line each: a link to the published doc
  that covers it, or a short plain-words note until one does (see "Finish a task").
- **`goal.md`** — the direction, in the user's words. The user owns it; the agent seeds a
  template but never invents the goal.
- **`decisions.md`** — settled answers to cards' open questions, one line each. Only
  **user-facing calls that help future planning**; code detail (which file, function,
  flag) stays on the card.
- **`redesign.md`** — design mistakes to avoid.
- **`rejected.md`** — ideas we turned down, and why.

The set exists at two levels: `docs/kanban/memory/<module>/` for one module, the board
root for the umbrella project. **Pick one copy by the card's `modules:` field and use only
that one** — the named module's (both, if it names two), else the root's. Never write a
note to both: the root is the whole project's memory, not a mirror of the modules. A
module's folder is scaffolded by `${KB} memory-init <module>` (idempotent) as soon as the
module is known — `init` does it for every module already on the map, the update flow does
it for the rest, and any flow about to write a note runs it first.

## Auto-pruning

To compress the memory set — at the board root and in each module copy — down to
planning-useful summaries, follow `references/prune-memory.md`.

## Document a change

A card that ships something users can see carries todos to update the docs it touches, so
the change isn't hidden. Follow `references/document-feature.md` — it maps a change to the
surfaces in your reference docs that need updating. No such docs kept? This is a no-op.

## Refs

- your roadmap doc (Configuration) — product direction.
- your user-facing docs (Configuration) — what you promise and teach users.
- `references/presets/` — optional bundles that add tracks and reviews for a specific kind of project (e.g. `indie-hacker.md`).
