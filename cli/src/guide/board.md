# How this board works

These rules apply to every card workflow. Read them once; each workflow's guide covers
the remaining details.

## Layout

```
docs/kanban/
├── todo/           open tasks
│   ├── README.md   the index — read it first
│   └── <id>-<slug>.md
│                   one card per file; a group keeps its cards in one folder
├── memory/         all memory — see "Who owns a memory file"
│   ├── readme.md   what shipped — the board's own record
│   ├── project.md  what the project is today — written only by `akb describe-project`
│   ├── <name>/     a global memory: `MEMORY.md` (its rules, unless built in), `README.md`
│   │               (its index) and its entries
│   └── agents/     one folder per agent that keeps memory, named after it —
│                   `planner/` holds `decisions.md`, `rejected.md`, `redesign.md`
├── rules/          `<agent>.md` — the user's rule for one agent, appended to every run it
│                   does; written from the board UI or `akb raw rule`
├── triage/         items waiting to be sorted, one file each — not cards. Only
│   │               Cloud's sort or Refine idea on the web's Triage page turns one
│   │               into a card; `akb triage check <source-id>` finds an existing one
│   ├── archived/   items a card was made of
│   ├── dismissed/  items ignored, with the reason — `akb triage restore` puts one back
│   └── files/      dropped-in files
└── modules.md      one line per module — `akb guide module-map` writes it
```

## Task ID

Every task's id is the number at the front of its filename (`04-plan-cap-enforcement.md` →
id 4): its Cloud task's number (`WC-4`). Only Cloud assigns one; `akb raw create` takes it.

## Never hand-write a card's frontmatter

`akb raw create`, `update`, and `update-questions` manage all of a card's frontmatter,
including its `previews`. Edit only the card's **body** by hand. `akb raw help`
lists all operations; `akb raw help <move>` explains one operation.

## Inside a board run

A board run carries `KANBAN_RUN` in its environment. Never unset or bypass it (for example
`env -u KANBAN_RUN`): when a command only prints a flow, follow the printed flow.

## Group task

A group lives in `todo/<id>-<slug>/`: `root.md` tracks the whole job and each subtask is its
own card beside it; `akb guide add-task` says how to build one. The root's `## Todo` lists the
subtasks, one line each ending in `#<subid>`: archiving a subtask ticks its line, rejecting
one strikes it through, and resolving the last line archives the root in the same run, with
any open question or unticked todo of its own. A board a Runner keeps leaves that close to
Cloud, which waits for the root to be queued with no step on it. A root listing no subtasks is
only closed by hand.

## Who owns a memory file

**A memory file belongs to whoever reads and writes it.**

- **`memory/readme.md`**: the board's record of shipped user-facing work.
- **`memory/project.md`**: what the project is today, from its users' side, and the
  direction every judgement serves. Only `akb describe-project` writes it.
- **`memory/agents/planner/`**: `decisions.md` holds user-facing answers that guide future
  planning and `redesign.md` design mistakes to avoid, both written by the memory review (`akb
  guide review-memory`); `rejected.md` holds what the user turned down and why, written only
  by the rejection and dismissal review (`akb guide review-rejections`). Other flows only read
  them, `akb prune-memory` aside.
- **`memory/<name>/`**: a global memory, kept by every agent listing it under `akb.memory`
  by the rules each run is given. Only the user changes its `MEMORY.md`, from the board UI.
- **`memory/agents/<agent>/`**: an agent keeps only the files and split paths its own AGENT.md
  declares, plus the `redesign.md` the memory review writes there. An agent whose instructions
  name none keeps none.

File a planning note about one module in that module's folder,
`memory/agents/planner/<module>/`, under the same file name, creating it if missing. A note
spanning modules, or from a card with none, stays in `memory/agents/planner/`.

### What earns a note

Only what changes a future planning choice. Writing nothing is a complete outcome.

- **Honor an opt-out**: told not to record, write no memory and finish the requested action.
- **A conversation writes none**: a card chat, a discussion, a feedback conversation, and
  any flow started in it write no memory and say nothing about it.
- **Require lasting value**: a durable preference, constraint, decision, or lesson.
- **Skip housekeeping**: duplicates, routine status changes, and facts recorded elsewhere.
  A rejected duplicate is not a rejected feature.
- **Merge, don't repeat**: rewrite an equivalent entry in place.

`readme.md` is not planning memory.
