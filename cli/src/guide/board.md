# How this board works

These rules apply to every card workflow. Read them once; each workflow's guide covers
the remaining details.

## Layout

```
docs/kanban/
├── todo/           open tasks
│   ├── README.md   the index — read it first
│   ├── <id>-<slug>.md
│   │               one card per file — todo/ is flat
│   └── recurring/  jobs we repeat (`akb guide recurring-task`) — never archived
├── memory/         all memory — see "Who owns a memory file"
│   ├── readme.md   what shipped — the board's own record
│   ├── goal.md     the long-term goal, horizon, and roadmap
│   └── agents/     one folder per agent that keeps memory, named after it —
│                   `planner/` holds `decisions.md`, `rejected.md`, `redesign.md`
├── rules/          `<agent>.md` — the user's rule for one agent, appended to every run it
│                   does; written from the board UI or `akb raw rule`
├── triage/         items waiting to be sorted, one file each — not cards. Only
│   │               `akb triage run` or the page's Make card turns one into a card;
│   │               `akb triage check <source-id>` finds an existing one
│   ├── archived/   items a card was made of
│   ├── dismissed/  items ignored, with the reason — `akb triage restore` puts one back
│   └── files/      dropped-in files
├── modules.md      one line per module — `akb guide module-map` writes it
├── config.md       project settings — created by init and completed by the user
├── releases.md     the open releases, in the order they ship — one line each
├── setup-checklist.md
│                   setup's own steps, while setup is unfinished (`akb guide setup`) —
│                   completing the last item deletes the file
├── next-id         the next free task id — NEVER edit by hand; only `akb raw` writes it
└── metrics.csv     one row per day: completed, created, rejected — never touch
```

## Configuration

**Read `docs/kanban/config.md` before proposing or adding tasks, and when a question audit
needs planning sources or reference docs.** It defines the project name, planning sources,
and reference docs. Board updates leave it unchanged. References to "your planning sources"
or "your reference docs" mean the values in this file.

## Task ID

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4). Ids are global and never reused; only `akb raw create` allocates them.

## Never hand-write a card's frontmatter

`akb raw create`, `update`, `update-questions`, `update-verify`, and `schedule` manage
the metadata: title, priority, roi, status, release, blocked_by, related, modules,
questions, verify, and schedule. Edit only the card's **body** by hand. `akb raw help`
lists all operations; `akb raw help <move>` explains one operation.

## The board's language

A run is told which language to write the board's prose in; told nothing, write English.

- **Follows the language**: card titles and bodies, open questions and their options,
  `verify:` lines, memory notes, changelogs, and replies to the user.
- **Prose in frontmatter is still prose**: titles, questions, options, `verify:` lines.
- **Stays English**: frontmatter keys and fixed values, `##`/`###` headings, the
  `<!-- agent -->` boundary, todo checkboxes, the `[user]` tag, module names, and filenames.
  The board matches these literally. A non-English title needs
  `akb raw create --slug <short-english-slug>`, and a group folder an English slug.
- **An edit follows the file, not the setting**: an existing card or memory file keeps its
  language. Open questions, their options and `verify:` lines follow the setting on every
  card; so does a rewritten changelog (`akb guide changelog`).
- **A memory file holding only its seeded header is empty**: its first note follows the
  setting.
- **Not the repository's**: code, comments, commit messages, and repository documents
  follow the repository.

## Group task

A **group task** is broad enough that even its subtasks may need further splitting. It
lives in its own folder:

```
todo/<id>-<short-slug>/
  root.md                            # the tracking task
  <subid>-<slug>.md                  # a subtask, its own card
```

`create` writes one card at a time into `todo/`, so build a group card by card and then
move the files into the group's folder:

1. **Write the root**: `akb raw create --title "<the whole job>"`. Call the id it prints
   `<id>`.
2. **Write each subtask**: `akb raw create --title "<one piece>" --related <id>`, adding
   `--blocked-by <subid>` where execution order matters.
3. **Move the files**: the root becomes `todo/<id>-<short-slug>/root.md`, and each subtask
   goes under `todo/<id>-<short-slug>/` with its filename unchanged. The folder's slug is
   short English ASCII whatever language the root's title is in.
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

## Who owns a memory file

**A memory file belongs to whoever reads and writes it.**

- **`memory/readme.md`**: the board's record of shipped user-facing work (see "Finish a task").
- **`memory/goal.md`**: the user's goal, horizon, and roadmap. Optional; never write it for
  them. Only update its `reviewed` field — `strong`, `good`, `pending`, or `weak` (missing,
  empty, or too vague). Replace `pending` with an assessment the next time you read it,
  without interrupting the user.
- **`memory/agents/planner/`**: owned by the plan lead — `software-planner`, or the agent a
  workflow names in its place. `decisions.md` holds user-facing answers that guide future planning,
  `redesign.md` design mistakes to avoid, `rejected.md` turned-down ideas and why. Flows that
  only judge — the gate, the decider, the sweep, triage, a reflection — read them and write none.
- **`memory/agents/<agent>/`**: a spec agent keeps the files its own AGENT.md names, and only
  those (`akb guide update-questions`). An agent whose instructions name none keeps none.

File a note under the `## <module>` heading its card's `modules:` names, creating it if
missing. There are no per-module folders.

### What earns a note

Only what changes a future planning choice. Writing nothing is a complete outcome.

- **Honor an opt-out**: told not to record, or a discarding reject, write no memory and
  finish the requested action.
- **A conversation writes none**: a card chat, a discussion, a feedback conversation, and
  any flow started in it write no memory and say nothing about it; the daily review reads
  the whole exchange instead (`akb guide review-memory`). Setup is not a
  conversation: its goal and first decisions stand.
- **Require lasting value**: a durable preference, constraint, decision, or lesson.
- **Skip housekeeping**: duplicates, routine status changes, and facts recorded elsewhere.
  A rejected duplicate is not a rejected feature.
- **Merge, don't repeat**: rewrite an equivalent entry in place.

`readme.md` is not planning memory; it follows "Finish a task".

## Archive/Finish a task

**`akb raw archive <id>` is the only way a task leaves the board.** It files the card,
drops it from the index, counts the completion, and prints every line that still points at
the id so you can fix them.

**Never finish a task by hand.** Deleting the card file, or writing a line into `next-id`
or `metrics.csv` yourself, leaves other cards' `blocked_by:` and `related:` pointing at a
card that no longer exists — the command is what finds those, and nothing else will. A run
that does this is reported as having broken the board.

This applies only to one-shot tasks. For recurring cards, see `akb guide recurring-task`.

Before archiving, record each user-facing outcome on one line in
`docs/kanban/memory/readme.md`, under the `## <module>` heading the card's `modules:` names.
Do not record internal-only changes. Use formats like these:

- ✅ Updating an installed board: `akb guide update`. Link to a published doc when
  available; do not restate it.
- ✅ The landing page is available in Chinese, Spanish, Japanese, and French at `/zh`,
  `/es`, `/ja`, and `/fr`. When no doc exists, state plainly what the user can now do.
- ❌ The landing site is live on Cloudflare Pages. This describes infrastructure, not
  user-facing behavior.

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
