# How this board works

These rules apply to every card workflow. Read them once; each workflow's guide covers
the remaining details.

## Card format

A card has a **human half** for review and a folded **agent half** for implementation.

Every flow writes a card in this order:

```
<one short paragraph: what the task does, and what is wrong without it.>

## Worth noting              <- answered material decisions; omit when empty
- **<question the decision settles>**: <answer>

## Worth noting after implementation
                             <- what building it turned up; written by review, omit when
                                empty. Never part of what a delivery is approved to build

## By `<name>` agent         <- only while a [user] open question points at it

<!-- agent -->               <- boundary

## Today
## Scope                     <- requirements, not rationale
## Todo                      <- one build step per checkbox
## By `<name>` agent
## Decided by the agent
- **<question the decision settles>**: <answer>
### Overruled by the user    <- always last
## Source
```

### Writing rules

Use professional, comprehensible language that a fresh reader can understand quickly.

- **One rule per bullet**: use `- **<short title>**: <one clear sentence>`.
- **Specify behavior**: omit planning notes and unnecessary coding details.
- **Keep the human half independent**: nothing above the boundary may rely on the folded
  agent half.
- **Record answered decisions consistently**: use `- **<question>**: <answer>` in
  `## Worth noting` for material calls a reviewer may reverse, and in
  `## Decided by the agent` for the rest.
- **Keep post-implementation notes out of the plan**: `## Worth noting after
  implementation` holds what building the card turned up — a surprise the next card should
  know, a check that was already failing, a split worth making, an exception the user
  approved for one delivery's work. It never blocks anything, and a delivery already in
  flight does not read it as a new requirement (`akb guide review`).
- **Keep questions distinct**: an untagged `questions:` entry is a necessary case or
  detail not yet considered; a `[user]` open question requires judgment the agent cannot
  supply, such as taste, business direction, spending, or a costly tradeoff.
- **Answer agent-owned questions**: research or choose a sensible reversible default,
  record the decision, and remove the question.
- **Preserve completed work**: never edit, delete, or untick a checked todo; append a todo
  to reverse it.
- **Preserve spec-agent sections**: only the named agent may rewrite its section; other
  flows may only move it across the boundary.
- **Record user decisions in `decisions.md`**: see "The memory set".

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
├── deliveries/     one JSON file per delivery — what an Implement click built, the card
│                   exactly as it was approved for it, and how it ended. Tracked in git,
│                   kept after the card is archived; nobody edits one by hand
├── rules/          one rule per flow, in the user's own words — `<command>.md`, named by
│                   the command a user types (`revise.md` for `akb revise`). It is appended
│                   to the end of that flow's instructions, so every run the board
│                   starts from that flow reads it. Tracked in git; a missing or empty file
│                   means the flow runs unchanged. Written from the board UI, not by hand
├── modules.md      one line per module — `akb guide module-map` writes it
├── config.md       project settings — created by init and completed by the user
├── releases.md     the open releases, in the order they ship — one line each
├── setup-checklist.md
│                   setup's own steps, while setup is unfinished (`akb guide setup`) —
│                   completing the last item deletes the file
├── next-id         the next free task id — NEVER edit by hand; only `akb board` writes it
├── metrics.csv     one row per day: completed, created, rejected — never touch
└── record.csv      what board commands counted as they ran — they own it, nobody edits
                    it by hand
```

## Configuration

**Read `docs/kanban/config.md` before proposing, adding, or refining tasks.** It defines
the project name, tracks, planning sources, reference docs, and optional preset. Board
updates leave it unchanged. References to "your tracks," "planning sources," or
"reference docs" mean the values in this file.

## Task ID

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only `akb board create` allocates them.

## Tracks

A track categorizes a task. Each track has a folder under `todo/`, and
`docs/kanban/config.md` lists the tracks configured during setup.

## Never hand-write a card's frontmatter

`akb board create`, `update`, `update-questions`, `update-verify`, and `schedule` manage
the metadata: title, track, priority, roi, status, release, blocked_by, related, modules,
questions, verify, and schedule. Edit only the card's **body** by hand. `akb board help`
lists all operations; `akb board help <move>` explains one operation.

Optionally tag a card with up to two modules using `--modules` (see
`docs/kanban/modules.md`). If no existing module fits, add one according to
`akb guide module-map`.

## Group task

A **group task** is broad enough that even its subtasks may need further splitting. It
lives in its own folder:

```
todo/<id>-<short-slug>/
  root.md                            # the tracking task
  <track>/<subid>-<slug>.md          # a subtask, its own card, under any track folder
```

`create` writes one card at a time into a track folder, so build a group card by card and
then move the files into the group's folder:

1. **Write the root**: `akb board create --title "<the whole job>" --track <track>`. Call
   the id it prints `<id>`.
2. **Write each subtask**: `akb board create --title "<one piece>" --track <track>
   --related <id>`, adding `--blocked-by <subid>` where execution order matters.
3. **Move the files**: the root becomes `todo/<id>-<short-slug>/root.md`, and each subtask
   goes under `todo/<id>-<short-slug>/<track>/` with its filename unchanged.
4. **Point the root at its pieces**: `akb board update <id> --related <subid,subid,...>`.
   At create time `--related` can only name ids that already exist, so the root's list is
   filled in here.
5. **Repoint the moved cards in `todo/README.md`**: give each bullet the card's new path
   and leave it under the heading it is already in. That index is not frontmatter — edit
   it directly.

- **`--track` always takes a real track name**: the frontmatter `track` is the column the
  board shows the card in. Passing a folder path such as `<id>-<slug>/<track>` puts the
  file in the right place but leaves the card out of every column.
- **The root's `## Todo` lists the subtasks**: one line each, ending in `#<subid>`.
  Archiving a subtask ticks its line off; rejecting one strikes it through.
- **Never reserve ids up front**: `akb board create --count <N>` prints ids that no card
  can be given — writing a card always takes a fresh id — so the reserved numbers are
  burnt and the board's numbering jumps.

## The memory set

The project's memory is a **fixed set of four files**:

- **`readme.md`** — shipped user-facing work, one line each: a link to the published doc
  that covers it, or a short plain-words note until one does (see "Finish a task").
- **`decisions.md`** — settled answers to cards' open questions, one per line. Include
  only **user-facing decisions that inform future planning**; keep code details on the
  card.
- **`redesign.md`** — design mistakes to avoid.
- **`rejected.md`** — ideas we turned down, and why.

The set exists at the project level in `docs/kanban/memory/` and at the module level in
`docs/kanban/memory/<module>/`. **Choose the set from the card's `modules:` field.** Use
each named module's set, or the project-level set if the card names no modules. Never
copy a note between levels; project memory is not a mirror of module memory. Initialize
a module's folder with the idempotent `akb board memory-init <module>` command before
writing to it. `init` does this for every module already in the module map.

**`goal.md` sits outside the set, in the project-level memory directory only.** It records
the long-term goal, horizon, and roadmap in the user's words. The agent changes only the
`reviewed` frontmatter field, whose allowed values are `strong`, `good`, `pending`, and
`weak`. Use `weak` when the goal is missing, empty, or too vague for evaluating
proposals. The board sets `pending` when a goal is saved; replace it with an assessment
the next time you read the goal. Assess it during the `goal` setup step and every propose
run without interrupting the user.

## Archive/Finish a task

**`akb board archive <id>` is the only way a task leaves the board.** It files the card,
drops it from the index, counts the completion, and prints every line that still points at
the id so you can fix them.

**Never finish a task by hand.** Deleting the card file, or writing a line into `next-id`,
`metrics.csv` or `record.csv` yourself, leaves other cards' `blocked_by:` and `related:`
pointing at a card that no longer exists — the command is what finds those, and nothing
else will. A run that does this is reported as having broken the board.

This applies only to one-shot tasks. For recurring cards, see `akb guide recurring-task`.

Before archiving, record each user-facing outcome on one line in `readme.md`. Do not record
internal-only changes. Use formats like these:

- ✅ (docs/kanban/memory/skill/readme.md) Updating an installed board: `akb guide update`.
  Link to a published doc when available; do not restate it.
- ✅ (docs/kanban/memory/site/readme.md) The landing page is available in Chinese,
  Spanish, Japanese, and French at `/zh`, `/es`, `/ja`, and `/fr`. When no doc exists,
  state plainly what the user can now do.
- ❌ (docs/kanban/memory/site/readme.md) The landing site is live on Cloudflare Pages.
  This describes infrastructure, not user-facing behavior.

Then run `akb board archive <id>`, and fix whatever it reports still mentioning the id.

## Record a redesign

When the user corrects a missing requirement or design mistake, add a short entry to
`redesign.md` under the relevant topic, or create a topic if needed. Write guidance for
future tasks, not a history of the fix. Format:
`- ❌ **<mistake>** → ✅ <what the design should be instead, one line>.`

## Setup gate

The presence of `docs/kanban/setup-checklist.md` means setup is unfinished. Completing
the final item deletes the file. Until then, only setup's final step may create cards.
See `akb guide setup`.
