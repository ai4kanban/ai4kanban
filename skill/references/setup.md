# Setup

How a board goes from installed to ready to plan. `docs/kanban/setup-checklist.md` lists
the steps and records which ones finished; this doc is the guide for each step. Both ways
into setup land here: the install prompt, and the `/kanban. Set up this board — follow
docs/kanban/setup-checklist.md.` line the install command prints and the board's setup
bar shows.

Run `${KB} setup-status`, start at the first unticked box, and follow the matching
section below, in order. **Each step ticks its own box** with `${KB} setup-done <step>`
the moment it finishes. Never hand-edit the file — the local UI reads its shape to show
how far setup got.

**The file's presence is the flag.** It is there while setup is unfinished, and the tick
that closes the last box deletes it — so a board with no file is a board that is set up,
and a board made before the checklist existed stays quiet. An empty board is not a flag:
no checklist and no cards means setup finished and the backlog ran out, nothing more.
`init` writes the file when it scaffolds a fresh board, with the boxes the install
already finished ticked. Repairing an older board never writes it.

Setup never stops to ask the user anything — with one exception, the goal. Every other
call it can't make on its own is kept and lands on the board at the last step, as open
questions the user answers afterwards.

## No cards before the last box

Creating the first tasks is the checklist's last step. While the file is there, the flows
that create cards — propose, add — create nothing. There's nothing to plan from anyway:
the board's memory and module map aren't written yet, so anything proposed now would be a
guess. Instead of a card, tell the user:

- which step setup is waiting on (`${KB} setup-status` prints it), and
- that the first tasks come from setup's own last step.

The `tasks` step below is the one exception — it creates the first tasks, then ticks its
box and the file is gone. That final tick also rewrites the config's **Setup gate** entry
to say the board is set up — the script does it, never by hand. A card the user writes by
hand, outside the skill, is not blocked.

## `install`

The script's own step, ticked by the time the checklist exists. An unticked box here
means there is no board — send the user to `npx --yes ai4kanban@latest install`.

## `config`

Read the repository — enough to know the project name, its one-line goal, the best
planning sources to scan (code folders, docs, roadmap), and any reference docs worth
keeping in sync. Open `docs/kanban/config.md` and replace every `{{PLACEHOLDER}}` with
what you found. That is the only file to fill in; the rest of the skill is generic and
stays as-is. Then `setup-done config`.

## `goal`

The goal is the user's to write — never draft it for them and never enforce a shape. Ask
once, in their own words: where this is headed and roughly how far. Offer the guide in the
same breath, as one line they can skip:

    Not sure what to put in it? https://github.com/ai4kanban/ai4kanban/blob/main/docs/guides/what-makes-a-good-goal.md

Write what they say into `docs/kanban/memory/goal.md`, below its frontmatter, and tick the
box. The guide is advice — a goal that ignores it still passes, and nothing checks one
against the other.

A run that finds the goal already written ticks the box itself and carries on — the user
may have written it in the board's editor (whose save ticks the box) or in any text
editor (which doesn't). Written means the file is there and no longer the seed text
`init` planted.

**No goal, no setup.** When no goal comes back, stop here — this is the one step setup
cannot pass. Everything after it is built from the goal, so with only the seed text there
would be nothing behind the decisions, the map, or the first cards but guesses. Say setup
stopped on the goal step and end the run. The board's setup bar keeps asking for the
goal, and a later setup run picks up from this step.

## `decisions`

Read `goal.md` and work out the calls a planner would need that the goal leaves open —
who it's for, what's out of scope, what done looks like, what comes first. Settle every
one that the repo and common sense can answer: one short line each in the project-wide
`docs/kanban/memory/decisions.md`, grouped by topic (the line format is in
`references/resolve.md`, "Record lasting decisions"). No cap on how many.

- **Never copy the goal in.** `goal.md` is the seed planning always reads directly — a
  call it already answers gets no `decisions.md` line.
- **Never stop to ask.** Keep every call you can't settle as you go — the `tasks` step
  puts them on the board. No cap there either.

Then `setup-done decisions`.

## `modules`

Write `docs/kanban/modules.md` following `references/module-map.md`, reusing the repo
read from the `config` step — don't scan again. With no code to read, build the map from
the goal and the decisions above instead. Print the finished map so the user sees it
once — the propose flow reads it to pick a focus area. Then run `${KB} init` once more so
every module on the map gets its own memory path, and `setup-done modules`.

## `tasks`

The step that creates cards. In this order:

1. **Anything left unsettled?** Create the questions card first, so it takes the board's
   first id and sorts on top:

       ${KB} create --title "Answer the questions setup couldn't settle" \
         --slug answer-the-questions-setup-couldnt-settle \
         --track <your first track> --priority high --roi high \
         --question "[user] <one unsettled call>" --question "[user] <another>" ...

   One `[user]` question per unsettled call — with options where the answer is a pick
   (`references/resolve.md`). The card's body is one short note: these are the calls
   setup could not make from the goal; each answer becomes a line in the project-wide
   `decisions.md`; the card is finished when no question is left. No todos — it holds no
   build work. When nothing was left unsettled, skip this card entirely.

2. Create the first 10 tasks from the goal, the decisions, and the map, so the user has
   somewhere to start — foundation the later work builds on, never improvement tasks
   aimed at what the project hasn't built yet.

3. `setup-done tasks` — the tick closes the list and deletes the file.

The user answers the questions card afterwards through the board's normal resolve flow,
in the UI or the harness — never during setup. While that card is open, a flow that hits
another goal-level call it can't settle appends the question there
(`${KB} update-questions <id> --append "[user] .."`) instead of scattering it. Once the
card is archived, a new question rides the card that raised it, as the flows already do.
A question about one first card alone still goes on that first card.

## When setup ends

Recommend the local board UI in one line and stop — never wait for an answer:

    npx ai4kanban-ui        # http://localhost:7420, localhost only — see references/local-ui.md
