# Setup

```
akb board setup-status         # how far setup got; says finished when there's no checklist
akb board setup-done <step>    # tick one box on setup's checklist as that step finishes
                               # steps: install, project, goal, agent, config, decisions,
                               #        modules, tasks
```

Run `setup-status`, start at the first unticked box, and follow the matching section
below, in order. Each step ticks its own box the moment it finishes. Never hand-edit
`docs/kanban/setup-checklist.md` — the local UI reads its shape.

The first three boxes are the user's own (`owner: you`) — what only they know. The board
app asks for them one screen at a time on its first run, so on a board driven from the app
they are ticked before you ever start. Ticked boxes are answered: never ask again for
anything they settled.

While the checklist exists, create no cards — not from propose, not from add. And never
stop to ask the user anything except the goal: the moment you hit a call you can't make
on your own, append it to the questions card the install created —
`akb board update-questions <id> --append "[user] .."`, with options where the answer is a
pick (`akb guide resolve`). `akb board setup-status` prints the card's id.

## `project`

What the project is and what tracks its work falls into — the two things in
`docs/kanban/config.md` a repo can't settle on its own. The board app asks the user for
both; you only reach this box when nobody has. Fill `{{PROJECT_NAME}}`, `{{PROJECT_GOAL}}`
and `{{TRACKS}}` from the repo, keep the track list to the folders that exist under
`docs/kanban/todo/`, and add a folder for any track you add. Then `setup-done project`.

## `goal`

The user writes this one. `docs/kanban/memory/goal.md` starts empty, so the ask is yours:
where the project is headed in their own words — what they want, how far out, and roughly
what comes next. Rough and short is fine. Add one line they can skip:

    Not sure what to put in it? https://github.com/ai4kanban/ai4kanban/blob/main/docs/guides/what-makes-a-good-goal.md

Put their answer below the frontmatter. A goal already written — the file has words in it
— is taken as is. Either way, judge it now and set `reviewed:` in the frontmatter yourself
(`strong | good | weak`, see "The memory set" in `akb guide board`), then tick the box. No answer
means stop the run; a later one resumes here.

## `agent`

Which agent runs this board's own buttons, and the key it uses. It is asked for in the
board app's Agent settings, which saves it and ticks this box — so on a board driven from
the app you never reach here.

You reach it when the user is driving the board from a coding agent instead: that is you,
and it is a complete answer. Tick it — `setup-done agent` — and say in one line that the
board app can run the work itself once an agent is picked in its settings.

## `config`

Fill every `{{PLACEHOLDER}}` still left in `docs/kanban/config.md` from the repo — each
one's note says what goes in it. The project and the tracks are settled by then; don't
rewrite them. Then `setup-done config`.

## `decisions`

Work out the calls a planner would need that the goal leaves open — who it's for, what's
out of scope, what done looks like, what comes first — and settle every one the repo and
common sense can answer: one short line each in `docs/kanban/memory/decisions.md`,
grouped by topic (line format: `akb guide resolve`, "Record lasting decisions").
Don't copy in what `goal.md` already answers — planning reads the goal directly. Then
`setup-done decisions`.

## `modules`

Two halves, one step: write the map, then file the settled calls under it.

Write `docs/kanban/modules.md` following `akb guide module-map` — from the repo
already read at `config` (don't scan again), or from the goal and decisions when there
is no code. Print the map, then run `akb board init` again so every module gets its memory
path.

Now split `docs/kanban/memory/decisions.md`, so the first tasks are planned from memory
that already sits in the right place:

- A call belongs to a module when a user would only meet it in that part of the product —
  the same test that tags a card with a module. Exactly one owner means the line moves to
  that module's `decisions.md`.
- A call it takes two modules to state stays project-wide. If it splits cleanly into a
  half per module, write each half in its own module.
- Moves, not copies. A call lives in one place; the same line in two files drifts apart.
- One module on the map means every call moves into it and the project-wide file is left
  near-empty. That's right — planning reads that module's memory from then on.
- The project-wide memory files stay at the board root either way, even when they end up
  empty. A card that names no module still writes there.

Then `setup-done modules`. This split runs at setup only; a module the board gains later
is covered by `akb guide module-map`, on the step that adds a line.

## `tasks`

Create the first 10 tasks from the goal, the decisions, and the map — foundation the
later work builds on, never improvement tasks aimed at what isn't built yet. Then
`setup-done tasks` — the final tick also removes the questions card if nothing landed on
it, so never delete it yourself.

A questions card that kept its questions outlives setup: the user answers it through the
resolve flow, and while it is open, any flow that hits a goal-level call it can't settle
keeps appending there.

## When setup ends

Recommend the board app in one line and stop — never wait for an answer:

    Drive this board from buttons: https://ai4kanban.dev/download — see `akb guide local-ui`
