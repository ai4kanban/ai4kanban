# How this board works

These rules apply to every card workflow. Read them once; each workflow's guide covers
the remaining details.

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
│                   the command a user types (`revise.md` for `akb card revise`). It is appended
│                   to the end of that flow's instructions, so every run the board
│                   starts from that flow reads it. Tracked in git; a missing or empty file
│                   means the flow runs unchanged. Written from the board UI, not by hand
├── modules.md      one line per module — `akb guide module-map` writes it
├── config.md       project settings — created by init and completed by the user
├── releases.md     the open releases, in the order they ship — one line each
├── setup-checklist.md
│                   setup's own steps, while setup is unfinished (`akb guide setup`) —
│                   completing the last item deletes the file
├── next-id         the next free task id — NEVER edit by hand; only `akb raw` writes it
├── metrics.csv     one row per day: completed, created, rejected — never touch
└── record.csv      what board commands counted as they ran — they own it, nobody edits
                    it by hand
```

## Configuration

**Read `docs/kanban/config.md` before proposing or adding tasks, and when a question audit
needs planning sources or reference docs.** It defines the project name, tracks, planning
sources, reference docs, and optional preset. Board updates leave it unchanged. References
to "your tracks," "planning sources," or "reference docs" mean the values in this file.

## Task ID

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only `akb raw create` allocates them.

## Tracks

A track categorizes a task. Each track has a folder under `todo/`, and
`docs/kanban/config.md` lists the tracks configured during setup.

## Never hand-write a card's frontmatter

`akb raw create`, `update`, `update-questions`, `update-verify`, and `schedule` manage
the metadata: title, track, priority, roi, status, release, blocked_by, related, modules,
questions, verify, and schedule. Edit only the card's **body** by hand. `akb raw help`
lists all operations; `akb raw help <move>` explains one operation.

## The board's language

A run is told which language to write the board's prose in when the user reads the board in
something other than English. Told nothing, everything below is English.

- **Follows the language**: card titles and bodies, open questions and their options,
  `verify:` lines, memory notes, changelogs, and what the agent says back to the user.
- **Stays English whatever the setting**: frontmatter keys and their fixed values, `##` and
  `###` section headings, the `<!-- agent -->` boundary, todo checkboxes, the `[user]` tag,
  track names, module names, and card filenames. The board matches all of these by literal
  English text, so a translated one is a card it can no longer read.
- **Prose in frontmatter is still prose**: a title, a question, an option and a `verify:`
  line follow the language even though they sit in a field.
- **A title that is not English needs an English slug**: filenames are ASCII, so pass
  `akb raw create --slug <short-english-slug>`, and name a group's own folder with one too.
- **An edit follows the file, not the setting**: rewriting a card or a memory file that
  already exists keeps the language that file is already in. A changelog is the exception:
  the command replaces the whole block, so it follows the setting on a rewrite too
  (`akb guide changelog`).
- **Except what the user reads to decide**: an open question, its options and a `verify:`
  line follow the setting on every card — including one written in English — whether a pass
  appends them or rewrites ones already there. The body around them does not.
- **A memory file holding only its seeded header is empty**: the header is `akb`'s own text
  and stays English, so the first note a run adds follows the setting.
- **Not the code, and not the repository's own documents**: code, comments, commit messages
  and the files under `docs/` a card asks for follow the repository, not the reader.

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

1. **Write the root**: `akb raw create --title "<the whole job>" --track <track>`. Call
   the id it prints `<id>`.
2. **Write each subtask**: `akb raw create --title "<one piece>" --track <track>
   --related <id>`, adding `--blocked-by <subid>` where execution order matters.
3. **Move the files**: the root becomes `todo/<id>-<short-slug>/root.md`, and each subtask
   goes under `todo/<id>-<short-slug>/<track>/` with its filename unchanged. The folder's
   slug is short English ASCII whatever language the root's title is in.
4. **Point the root at its pieces**: `akb raw update <id> --related <subid,subid,...>`.
   At create time `--related` can only name ids that already exist, so the root's list is
   filled in here.
5. **Repoint the moved cards in `todo/README.md`**: give each bullet the card's new path
   and leave it under the heading it is already in. That index is not frontmatter — edit
   it directly.

- **The root's `## Todo` lists the subtasks**: one line each, ending in `#<subid>`.
  Archiving a subtask ticks its line off; rejecting one strikes it through.
- **The group closes itself**: resolving the last subtask line archives the root in the same
  run — a group is over the moment its pieces are, so nobody presses Archive. A finished
  root stays for a person when every line was struck out by reject, or when it carries an
  open question or an unticked todo of its own; the receipt names the rule that kept it. A
  root listing no subtasks is only ever closed by hand.

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
a module's folder with the idempotent `akb raw memory-init <module>` command before
writing to it. `init` does this for every module already in the module map.

**`goal.md` sits outside the set, in the project-level memory directory only.** It records
the long-term goal, horizon, and roadmap in the user's words. The agent changes only the
`reviewed` frontmatter field, whose allowed values are `strong`, `good`, `pending`, and
`weak`. Use `weak` when the goal is missing, empty, or too vague for evaluating
proposals. The board sets `pending` when a goal is saved; replace it with an assessment
the next time you read the goal. Assess it during the `goal` setup step and every propose
run without interrupting the user.

## Archive/Finish a task

**`akb raw archive <id>` is the only way a task leaves the board.** It files the card,
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

Then run `akb raw archive <id>`, and fix whatever it reports still mentioning the id.

## Record a redesign

When the user corrects a missing requirement or design mistake, add a short entry to
`redesign.md` under the relevant topic, or create a topic if needed. Write guidance for
future tasks, not a history of the fix. Format:
`- ❌ **<mistake>** → ✅ <what the design should be instead, one line>.`

## Setup gate

The presence of `docs/kanban/setup-checklist.md` means setup is unfinished. Completing
the final item deletes the file. Until then, only setup's final step may create cards.
See `akb guide setup`.
