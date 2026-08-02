# Setup

```
${KB} setup-status                  # how far setup got; says finished when there's no checklist
${KB} setup-done <step>             # tick one box on setup's checklist as that step finishes
                                    # steps: install, config, goal, decisions, modules, tasks
```

Run `setup-status`, start at the first unticked box, and follow the matching section
below, in order. Each step ticks its own box the moment it finishes. Never hand-edit
`docs/kanban/setup-checklist.md` — the local UI reads its shape.

While the checklist exists, create no cards — not from propose, not from add. And never
stop to ask the user anything except the goal: the moment you hit a call you can't make
on your own, append it to the questions card the install created —
`${KB} update-questions <id> --append "[user] .."`, with options where the answer is a
pick (`references/resolve.md`). `${KB} setup-status` prints the card's id.

## `config`

Fill every `{{PLACEHOLDER}}` in `docs/kanban/config.md` from the repo — each one's note
says what goes in it. Then `setup-done config`.

## `goal`

The user writes this one; the seed in `docs/kanban/memory/goal.md` says what it holds.
Ask for it, with one line they can skip:

    Not sure what to put in it? https://github.com/ai4kanban/ai4kanban/blob/main/docs/guides/what-makes-a-good-goal.md

Put their answer below the frontmatter and tick the box. A goal already written — the
file is past the seed text — just gets its tick. No answer means stop the run; a later
one resumes here.

## `decisions`

Work out the calls a planner would need that the goal leaves open — who it's for, what's
out of scope, what done looks like, what comes first — and settle every one the repo and
common sense can answer: one short line each in `docs/kanban/memory/decisions.md`,
grouped by topic (line format: `references/resolve.md`, "Record lasting decisions").
Don't copy in what `goal.md` already answers — planning reads the goal directly. Then
`setup-done decisions`.

## `modules`

Write `docs/kanban/modules.md` following `references/module-map.md` — from the repo
already read at `config` (don't scan again), or from the goal and decisions when there
is no code. Print the map, run `${KB} init` again so every module gets its memory path,
then `setup-done modules`.

## `tasks`

Create the first 10 tasks from the goal, the decisions, and the map — foundation the
later work builds on, never improvement tasks aimed at what isn't built yet. Then
`setup-done tasks` — the final tick also removes the questions card if nothing landed on
it, so never delete it yourself.

A questions card that kept its questions outlives setup: the user answers it through the
resolve flow, and while it is open, any flow that hits a goal-level call it can't settle
keeps appending there.

## When setup ends

Recommend the local board UI in one line and stop — never wait for an answer:

    npx ai4kanban-ui        # http://localhost:7420, localhost only — see references/local-ui.md
