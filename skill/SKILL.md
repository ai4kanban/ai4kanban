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

Write every card in plain, clear, short language — say what to do and why it matters.
No jargon, no business-speak, no clever phrasing. A non-native reader skimming should
get it in one pass.

- Bad: "Price it as a monthly retainer for an outcome stream."
- Good: "Charge $300/month. The user gets a brief each week and a report each month."

## Card format

A card is a minimal task spec, written for whoever implements the task, not whoever
plans it.

- **No meta notes**: say what problem the task solves and what changes for the user — never how
  the board planned it. No notes on what a refine changed, no meta-todos like `- [x]
  explore codebase and create the task #14`. A planning line was never build work — delete
  it on sight, ticked or not.
- **No coding details**: write the card from a product owner's angle — the effect on the
  user, not the implementation. Drop steps like `- add an npx tsc check after this
  feature`; the coding agent handles them well. Keep a step only when it's a project
  owner's concern, e.g. `- create 2 test cards, click the button, and check the flow
  end to end`.
- **`## Todo` is the build plan**: one step of real work per box.
- **Ticked boxes are history**: they record what was built — never edit, delete, or
  untick them; to undo earlier work, append a reverting todo.
- **`## Decided by the agent`**: a call the agent made on its own goes here, one short
  line each — the question, then the answer. The plan (the summary line, `## Scope`,
  `## Todo`) is the human's input; this section is what the agent complements, so anyone
  can see what it decided and overrule it. What the **user** decided isn't an agent call
  — that goes to `decisions.md` (see "The memory set").

## Layout

```
docs/kanban/
├── todo/           open tasks
│   ├── README.md   the index — read it first
│   ├── blockers/   hard blockers; they gate the next milestone — clear them first
│   ├── <track>/    one folder per track (see Configuration), one card per file
│   └── recurring/  jobs on a cadence (see "Recurring task") — never archived
├── memory/         all memory — see "The memory set"
│   ├── readme.md, decisions.md, rejected.md, redesign.md
│   │               the four-file set for the project as a whole
│   ├── goal.md     the long-term goal, horizon, and roadmap — this one file only,
│   │               never in a module folder
│   └── <module>/   a module's own copy of the four-file set
├── modules.md      one line per module — install writes it, propose reads it (see "The
│                   module map")
├── config.md       your project's settings (see Configuration) — seeded by init, yours to fill
├── next-id         the next free task id — NEVER edit by hand; only the script writes it
└── metrics.csv     one row per day: completed, created, rejected — script-kept; never touch
```

## The script

`kanban.mjs`, in this skill's folder, is the **only** sanctioned way to scaffold the board,
create, update, migrate, archive, or reject a task. It allocates ids, writes a card's
**frontmatter**, moves/removes task files, keeps the README index, and records the daily
metric.

Point `KB="node .claude/skills/kanban/kanban.mjs"`. Set it once and run every command from
the repo root as `${KB} <command>`:

```
${KB} init [track...]               # scaffold docs/kanban/ (tracks default to feature bug research)
                                    # re-run to repair an older board: adds missing config.md, modules.md, memory paths
${KB} create [--count N]            # allocate N ids (default 1), prints them
${KB} create --title ".." --track <track> [--priority high|med|low] [--roi high|med|low] \
             [--blocked-by 1,2] [--related 3] [--modules skill,site] [--question ".."] [--slug ..]
                                    # scaffold ONE card: frontmatter + body template + README entry; then fill only the body
${KB} update <id> [--priority ..] [--roi ..] [--track ..] [--slug ..] \
             [--blocked-by ..] [--related ..] [--modules ..] [--question ..] \
             [--drop-question 1,3] [--clear-questions]
                                    # rewrite a card's frontmatter; --track moves it, --slug renames
${KB} archive <id>                  # finish task <id>
${KB} reject  <id>                  # reject task <id>
${KB} run     <id>                  # record one run of recurring task <id> (card kept)
${KB} peek                          # current next-id, no bump
${KB} help                          # full usage
```

**Never hand-write a card's frontmatter.** Use `create`/`update` for the meta
(title, track, priority, roi, blocked_by, related, modules, questions); use Write/Edit only
for the card **body**.

Tag a card with `--modules` (see `docs/kanban/modules.md`);
optional — a task can touch two modules or none. Add a new line to modules.md according to `module-map.md`
if you find no match.

## Task id

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only the script's `create` allocates them.

## Propose new tasks

When the user asks to propose work, pick **one module** and propose **3 new tasks
inside it** — work nobody has planned yet. Full guide in `references/propose.md`.

## Add a task

Add a task from an idea. Full guide in `references/add-task.md`.

## Refine

Take one task and move it one step forward — from vague to concrete. A card with
unresolved `questions` in its frontmatter can't be refined — resolve them first. Full
guide in `references/refine.md`.

## Resolve open questions

When a card carries open `questions`, resolving them is the only way to move it forward.
Full guide in `references/resolve.md`.

## Auto-refine

Loop refining and clarifying a task until all questions answerable by agent itself are resolved.
Full guide in `references/auto-refine.md`.

## Group task

A **group task** is a broad task whose split yields subtasks that
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

Record user-facing behavior as one line in `readme.md` (see "The memory set").
Internal-only changes get no line. Write lines like these:

- ✅ (docs/kanban/memory/skill/readme.md) Updating an installed skill: `skill/references/update.md`.
  Tip: Points at a published doc if available. Don't restate what the doc says.
- ✅ (docs/kanban/memory/site/readme.md) The landing page reads in Chinese, Spanish, Japanese, and French at `/zh`, `/es`, `/ja`, `/fr`.
  Tip: No doc yet, so it says in plain words what the user can now do
- ❌ (docs/kanban/memory/site/readme.md) The landing site is live on Cloudflare Pages.
  Tip: Nothing the user can see or do.

Then run `${KB} archive <id>` to record the completion.

## Reject an idea

Rejecting is rare. When you (or the user) turn down an idea, add a short line to
`rejected.md` (see "The memory set") — under the topic that fits; start a new topic heading if none
fits. Format: `- **<idea name>** — <why we said no, one line>.`

Then run `${KB} reject <id>` to remove the card.

## Record a redesign

When the user corrects a card that missed a requirement or got the design wrong, add a
short entry to `redesign.md` (see "The memory set") — under the topic that fits; start a new topic heading if
none fits. This is a reference for the next task, not a record of the fix — say what to do
right, not what went wrong. Format:
`- ❌ **<mistake>** → ✅ <what the design should be instead, one line>.`

## The tracks

A track is the bucket a task lives in — one folder per track under `todo/`. Your tracks are listed in `docs/kanban/config.md` (Configuration), set during install.

## Recurring task

A recurring task is a job we repeat on a cadence (e.g. a weekly report), not a
one-shot. Full guide in `references/recurring-task.md`.

## Run the board locally

A small local UI server to drive the board from buttons instead of the terminal. Full guide in
`references/local-ui.md`.

## Updating the skill and local UI

Pulling a newer version into an installed project: `references/update.md`.

## The module map

`docs/kanban/modules.md` lists what parts the project is made of — one line per module.
To write or rebuild it, follow `references/module-map.md`.

## The memory set

The project's memory is a **fixed set of four files**:

- **`readme.md`** — shipped user-facing work, one line each: a link to the published doc
  that covers it, or a short plain-words note until one does (see "Finish a task").
- **`decisions.md`** — settled answers to cards' open questions, one line each. Only
  **user-facing calls that help future planning**; code detail (which file, function,
  flag) stays on the card.
- **`redesign.md`** — design mistakes to avoid.
- **`rejected.md`** — ideas we turned down, and why.

The set exists at two levels, both under `docs/kanban/memory/`:
`docs/kanban/memory/<module>/` for one module, `docs/kanban/memory/` itself for the
project as a whole. **Pick one copy by the card's `modules:` field and use only that
one** — the named module's (both, if it names two), else the project-wide one. Never write
a note to both: the project-wide copy is the whole project's memory, not a mirror of the
modules. A module's folder is scaffolded by `${KB} memory-init <module>` (idempotent) as
soon as the module is known — `init` does it for every module already on the map, the
update flow does it for the rest, and any flow about to write a note runs it first.

**`goal.md` sits outside the set, at the board root only** — the long-term goal, horizon,
and roadmap in the user's words; the agent never writes the goal, except a frontmatter line
`reviewed: strong | good | weak`.
This field says whether the goal is clear enough to plan from — `weak` only when apparent (missing, still the template, too vague to judge a proposal against).

## Auto-pruning

To compress the memory set — the project-wide copy and each module copy — down to
planning-useful summaries, follow `references/prune-memory.md`.

## Document a change

A card that ships something users can see carries todos to update the docs it touches, so
the change isn't hidden. Follow `references/document-feature.md` — it maps a change to the
surfaces in your reference docs that need updating. No such docs kept? This is a no-op.

## Refs

- your roadmap doc (Configuration) — product direction.
- your user-facing docs (Configuration) — what you promise and teach users.
- `references/presets/` — optional bundles that add tracks and reviews for a specific kind of project (e.g. `indie-hacker.md`).
