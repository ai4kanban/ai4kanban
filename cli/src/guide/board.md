# How this board works

The rules every card flow stands on. Read this once; the flow you were printed says the
rest.

## Writing style

Write every card in plain, clear, short language — say what to do and why it matters.
No jargon, no business-speak, no clever phrasing. A non-native reader skimming should
get it in one pass.

- Bad: "Price it as a monthly retainer for an outcome stream."
- Good: "Charge $300/month. The user gets a brief each week and a report each month."

## Card format

A card is a minimal task spec, written for whoever implements the task, not whoever
plans it.

- **No meta notes**: say what problem the task solves and what changes for the user — never
  how the board planned it. No notes on what a refine changed, no meta-todos like `- [x]
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
│   ├── <track>/    one folder per track (see "Configuration"), one card per file
│   └── recurring/  jobs we repeat (`akb guide recurring-task`) — never archived
├── memory/         all memory — see "The memory set"
│   ├── readme.md, decisions.md, rejected.md, redesign.md
│   │               the four-file set for the project as a whole
│   ├── goal.md     the long-term goal, horizon, and roadmap — this one file only,
│   │               never in a module folder
│   └── <module>/   a module's own copy of the four-file set
├── modules.md      one line per module — `akb guide module-map` writes it
├── config.md       your project's settings — seeded by init, the user's to fill
├── releases.md     the open releases, in the order they ship — one line each
├── setup-checklist.md
│                   setup's own steps, while setup is unfinished (`akb guide setup`) —
│                   the last tick deletes it; no file means the board is set up
├── next-id         the next free task id — NEVER edit by hand; only `akb board` writes it
└── metrics.csv     one row per day: completed, created, rejected — never touch
```

## Configuration

**Read `docs/kanban/config.md` before proposing, adding, or refining** — it carries the
project's settings: name, tracks, planning sources, reference docs, optional preset. It
lives with the board, so an update leaves it untouched. "Your tracks / planning sources /
reference docs" in any flow mean this file.

## Task id

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only `akb board create` allocates them.

## The tracks

A track is the bucket a task lives in — one folder per track under `todo/`. The tracks
this board uses are in `docs/kanban/config.md`, set during setup.

## Never hand-write a card's frontmatter

`akb board create` / `update` / `update-questions` / `schedule` own the meta (title, track,
priority, roi, status, release, blocked_by, related, modules, questions, schedule). Write and
edit only a card's **body**. `akb board help` lists every move; `akb board help <move>` is
one in full.

Tag a card with `--modules` (see `docs/kanban/modules.md`); optional — a task can touch two
modules or none. If no line fits, add one per `akb guide module-map`.

## Group task

A **group task** is a broad task whose split yields subtasks that *themselves* need
splitting — a dividable of a dividable. It lives in its own folder:

```
todo/<id>-<short-slug>/
  root.md                            # the tracking task
  <track>/<subid>-<slug>.md          # a subtask, its own card, under any track folder
```

The root and each subtask take their own ids — allocate them together with
`akb board create --count <N>`. Wire them up with the command's flags: each subtask is
**Related** to the root, and **Blocked by** between subtasks that must run in order.

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
modules. A module's folder is scaffolded by `akb board memory-init <module>` (idempotent)
as soon as the module is known — `init` does it for every module already on the map, and
any flow about to write a note runs it first.

**`goal.md` sits outside the set, at the board root only** — the long-term goal, horizon,
and roadmap in the user's words. It starts empty; the agent never writes the goal, except
the frontmatter line `reviewed: strong | good | pending | weak` — how clear the goal is to
plan from. `weak` only when apparent (missing, empty, too vague to judge a proposal
against). `pending` means written but not judged yet: the board sets it when a goal is
saved, and you replace it the next time you read the goal. Judge it at the `goal` setup
step and on every propose run — never stop to ask the user about it.

To compress the memory set down to planning-useful summaries, follow
`akb guide prune-memory`. The board ships with a recurring card that does this — never
create one.

## Finish a task

One-shot tasks only — a recurring card is never finished this way
(`akb guide recurring-task`).

Record user-facing behavior as one line in `readme.md`. Internal-only changes get no line.
Write lines like these:

- ✅ (docs/kanban/memory/skill/readme.md) Updating an installed board: `akb guide update`.
  Tip: Points at a published doc if available. Don't restate what the doc says.
- ✅ (docs/kanban/memory/site/readme.md) The landing page reads in Chinese, Spanish, Japanese, and French at `/zh`, `/es`, `/ja`, `/fr`.
  Tip: No doc yet, so it says in plain words what the user can now do.
- ❌ (docs/kanban/memory/site/readme.md) The landing site is live on Cloudflare Pages.
  Tip: Nothing the user can see or do.

Then run `akb board archive <id>` to record the completion.

## Record a redesign

When the user corrects a card that missed a requirement or got the design wrong, add a
short entry to `redesign.md` — under the topic that fits; start a new topic heading if none
fits. This is a reference for the next task, not a record of the fix — say what to do
right, not what went wrong. Format:
`- ❌ **<mistake>** → ✅ <what the design should be instead, one line>.`

## Setup gate

`docs/kanban/setup-checklist.md` being there says setup is unfinished — the last tick
deletes it. While it's there, no flow creates cards; setup's own last step is the only
exception. Full guide: `akb guide setup`.
