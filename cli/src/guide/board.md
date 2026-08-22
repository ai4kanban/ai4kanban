# How this board works

These rules apply to every card workflow. Read them once; each workflow's guide covers
the remaining details.

## Writing style

Write every card in professional, accessible language. A reader without prior context
should understand it on a quick read.

What that means line by line:

- **Use identifiable terms**: define unfamiliar terms when they first appear. Avoid
  labels that only the card's author would understand.
  - Bad: "one PATH read per screen draw" — "screen draw" is undefined.
  - Good: "Read `PATH` once each time the board page loads."
- **State the rule directly**: a concise explanation is clearer than a slogan that needs
  interpretation.
  - Bad: "Say it in a word, not only in colour."
  - Good: "Label the greyed-out agent as 'not installed'."
- **Put one rule in each bullet**: combined rules are easy to miss.
- **`## Scope` holds requirements, not rationale**: put the reasoning behind a
  requirement in `## Decided by the agent`. Explanations in `## Scope` obscure what to
  build.

## Card format

A card is a minimal task specification for the implementer, not the planner. It has two
readers, so it has two halves: the **human half** on top is what a reviewer needs to accept
or refuse the plan, and the **agent half** below it is what a builder needs to implement
it. The agent half is folded by default, so the human half has to stand on its own.

Every flow writes a card in this order:

```
<one short paragraph: what the task does, and what is wrong without it.>

## Worth noting               <- omit it when there is nothing to weigh
- <one line a reviewer can accept or refuse>

## By `<name>` agent          <- only while an open question points at it

<!-- agent -->

## Today
## Scope
## Todo
## By `<name>` agent
## Decided by the agent
## Source
```

- **`<!-- agent -->` marks the boundary**: one line, directly above the first agent half
  section. It never shows when the card is rendered. A card with nothing below it carries
  no marker.
- **The human half is a closed list**: the paragraph, `## Worth noting`, and a spec agent's
  section an open question points at. Every other section — `## Scope out`, `## Process`,
  and any heading the skeleton does not name — belongs to the agent half.
- **The human half stands alone**: no line in it depends on a section below the boundary.
  A reviewer reads it and knows what is being built and what to weigh.
- **`## Worth noting`**: one short line per point a reviewer could reasonably refuse — a
  choice that could have gone another way, a consequence they may not want to accept, a
  limit on what the task will not do. A point nobody could disagree with is not one of
  them.
- **Keep the human half true**: a flow that changes the agent half re-reads the paragraph
  and `## Worth noting` in the same pass and fixes whatever no longer holds.
- **A section the skeleton does not name has no slot**: it follows the named section it
  sits under, and one with no named section above it opens the agent half.
- **Both halves follow the writing rules above**: the agent half differs only in being
  detailed enough to build from.
- **No meta notes**: describe the problem and the user-visible change, not how the board
  planned the task. Delete planning notes such as `- [x] explore codebase and create the
  task #14`, whether checked or not.
- **No coding details**: describe the desired product behavior, not the implementation.
  Omit steps such as `- add an npx tsc check after this feature`. Keep validation steps
  that matter to the project owner, such as testing the complete flow with two cards.
- **`## Todo` is the build plan**: put one implementation step in each checkbox.
- **Ticked boxes are history**: never edit, delete, or untick them. To undo completed
  work, append a todo that reverts it.
- **`## Decided by the agent`**: record each decision the agent made independently as a
  short question-and-answer line. This separates agent judgment from the human-provided
  paragraph, `## Scope`, and `## Todo`, making each decision easy to review or overrule.
  A call a reviewer could reasonably refuse goes to `## Worth noting` instead. Record user
  decisions in `decisions.md` (see "The memory set").
- **`### Overruled by the user`**: the one subsection `## Decided by the agent` carries,
  always last — the calls the user reversed (`akb guide revise`).
- **``## By `<name>` agent``**: a spec agent's own section — the part of the spec that
  the named agent owns (`akb guide spec-agent`). Use it as planning input, but do not
  reword or delete it. Moving the whole section between the halves is the one change
  another flow may make. Only rerunning that agent may rewrite it.

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

The root and each subtask need separate ids; allocate them together with
`akb board create --count <N>`. Use the command's flags to relate every subtask to the
root and to add **Blocked by** links where execution order matters.

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
