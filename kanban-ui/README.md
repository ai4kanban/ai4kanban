# ai4kanban-ui

The local board UI for [ai4kanban](https://ai4kanban.dev/). It shows every track in
a browser and drives the work from buttons: each button spawns an agent in your repo that
does the kanban work for you — propose, refine, implement, archive.

The markdown files in `docs/kanban/` stay the single source of truth. The UI only reads and
writes those files, so nothing here is locked in.

```
npx ai4kanban-ui        # http://localhost:7420, localhost only
```

Installing it, pointing it at a board elsewhere, changing the port, updating: the skill's
`references/local-ui.md`. This file is about **using** it.

## The board

The home page is the board — one column per track, cards in priority order. Click a card to
open it: the full card body, its meta (track, modules, priority, ROI, blockers), its open
questions, and its buttons.

A card waiting on another card carries a small **lock** marker; hover it to see which cards
are in the way. It shows only while a blocker is still on the board — once that card is
archived or rejected the marker goes. A recurring card never counts as a blocker, since it
never closes. The card stays in its column either way: the marker says the work has an
order to it, it doesn't hide or gate anything.

There are two ways to look at the same board, and the **Board / Queue** switch in the header
flips between them. **Board** is the columns above, one per track. **Queue** drops the tracks
and splits the screen in two instead: **Ready to build** on the left — the cards marked ready,
and under them the ones already being implemented — and **Not ready** on the right, everything
still to be worked out. Each half counts what's in it, and the ready half counts both numbers
("5 ready · 1 implementing") so the first one is what you can start today.

The queue view hides nothing: every card the columns show is in one of the two halves. Inside
a half, the best card to start comes first — a card waiting on another sinks below the ones
you can start, and a blocker rises to the top of the rest, since there's no blockers column
here to make it stand out. Cards carry their track in this view for the same reason. The view
you pick is remembered in your browser, per board; nothing is written to the files.

The header carries five things:

- **Board / Queue** — the two views above.
- **Create task** — describe an idea in your words and the agent writes the card. The same
  dialog has a **Propose 3 tasks** mode: pick a module (or let the agent pick one) and it
  proposes three new tasks inside it. A **Boldness** row sets how big those tasks are —
  `safe` polishes what already works, `normal` is a feature each, and `bold` asks for a big
  leap each: a whole new capability, usually written as a group task.
- **Runs** — every agent session, live or finished. Open one to read its log. A finished run
  can be continued with a follow-up prompt; that starts a new run.
- **Daily progress** (the chart) — the last 30 days of the board, as a line each for
  completed, created, and rejected cards, with the totals above it. The numbers come from
  `docs/kanban/metrics.csv`, which the script keeps as you work; the view only reads it. A
  board with nothing recorded yet says so instead.
- **Configuration** (the gear) — see below.

### The goal bar

When the agent has judged `memory/goal.md` weak (`reviewed: weak` in its frontmatter — a
missing file counts too), a bar shows between the header and the columns asking you to
write the goal. Every proposal the agent makes is judged against that file, so a rough
answer beats a blank one. **Write the goal** opens a plain text editor on `goal.md` —
your own words, the agent never drafts it for you; the file holds the whole direction,
horizon and roadmap included. Saving writes the file and leaves the `reviewed:` field to
the agent — it re-judges on its next propose or refine pass, and the bar disappears once
the value turns `good` or `strong`. The ✕ hides the bar for the browser session. The board works the
same either way; the bar is a nudge, not a gate.

## A card's buttons

Every button opens one small dialog. You can type a note that goes to the agent, then
confirm. The card then shows a running badge and a live log you can read while it works. The
log is read-only — you never type into a running session.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo on the card is checked. Never on a group root. |
| **Edit** | Always. Say what to change and the agent revises the card. |
| **Resolve** | Only when the card has open questions. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). |
| **Reject** | Always. |

**Resolve** has a second confirm, **Resolve & implement**: the agent answers the questions
it can settle itself, and if nothing is left for you to decide it goes straight on to build
the card in the same run. If a real judgment call remains, it stops and leaves it for you.

When a card is blocked, **Waiting on #&lt;id&gt; — still open** sits next to **Implement**, with a
link to each blocking card. The button still works: it's there so you know what you're
starting ahead of, not to stop you.

There is no **Refine** button. Refining is automatic only — see Auto-refine below.

A run never commits. It leaves its changes in your working tree; you read `git diff` and
commit.

## Group tasks

A group task is a folder with a `root.md` and its subtasks under it. The root is a tracking
card, not something you build directly:

- The root shows **no Implement button**. A group is finished by finishing its subtasks, one
  card at a time.
- The root's **Archive** button appears once every subtask on it is resolved — ticked off
  (done) or struck through (rejected). Archiving the root closes the whole group.
- A group root that never got any subtasks can't be archived that way. Close it with
  **Reject**.

The root keeps this record itself: when a subtask is archived its line on the root is ticked,
and when a subtask is rejected its line is struck through. So the outcome survives even after
the subtask files are gone.

## Configuration

The gear in the header opens the **Configuration** dialog. It holds:

- **Agent** — pick the agent that every button spawns. It runs in your repo root.
- **Model** — the model that agent runs with. Type an id, or leave it empty to let the agent
  use its own default.
- **Auto-refine** — a switch. Turn it on and the server refines cards in the background:
  about once a minute it picks the highest-priority card that still needs refining and runs
  one refine on it, one card at a time. It answers the questions it's confident about and
  leaves the real judgment calls for you as open questions. With the switch off, no card is
  ever refined. While a refine is running, **Refining #&lt;id&gt;** sits beside the switch and
  names the card it is on; when nothing is running the label is gone.

Settings live in `docs/kanban/ui.config.json`, next to your board — so `npx` always serves
the latest UI and an update never touches your settings. Everything the dialog holds writes
itself there:

```json
{ "harness": { "name": "claude-code", "model": "claude-opus-5" }, "autoRefine": false }
```

`harness.name` is the agent. It decides everything about how that agent runs: the command,
the flags that make it stream its output into the live log, the env vars, and the flags the
**Resume** button uses. Claude Code is the default and the only agent today. If
the file names an agent this UI doesn't know, Claude Code runs and the dialog says so — you
are never moved to a different agent without being told.

`harness.model` is the model that agent runs with, passed to it as `--model <id>`. One model
for every button — there's no per-action model. Leave it empty (or leave the key out) and the
agent runs its own default; the board never invents an id for you. Nothing here checks the id:
a wrong one makes the run exit right away, and the reason is in that run's log.

To run a custom binary of that agent, or add flags to it, add a `harness.command` by hand:

```json
{ "harness": { "name": "claude-code", "command": "/my/bin/claude -p --model opus" } }
```

`harness.command` is a path or flags **for the agent `harness.name` picked** — not a way to
run a different one. The harness always adds its own flags on top, and another agent's binary
would reject them. To run a different agent, pick it. The harness's flags never override one
you set yourself. If the override already names a model, it wins and `harness.model` is not
added — one model flag, one place it comes from — and the dialog says the Model field isn't
in effect, so a filled-in field never looks broken.

Both the model and the override belong to the agent they were written for, so switching
agents in the dialog drops them.

Each run reads the setting once, when it starts — flipping the picker while an agent is
working changes what the next run spawns, never the one in flight. And each run records the
agent it ran under, so **Resume** only ever offers to continue a run the agent you have
picked can actually reach: switch agents and a run the old one started stops offering it,
rather than handing its id to a CLI that never heard of it.

### When a run fails or is interrupted

A run that stopped short — the peach dot in the sessions panel — shows a **Resume** button. It
sends one more turn into that same conversation (`claude --resume <id>`, run for you), so the
agent picks up where it stopped instead of starting the task over. Nothing is copied and you
never see an id.

Two things stop a run short, and the log says which. It **exited** with a non-zero code: the
agent itself gave up, and the reason is in its output. Or it was **interrupted**: the board
was still running it when the UI server died, so the agent ended out of our sight — no exit
code, no final message, no reason to think the work is done. An interrupted run is never
shown as finished, and its duration is marked `~` because it's an upper bound: the board only
learns the run ended when it next checks the process, which may be long after the fact.

Resume is a normal run — its own live log, on the same card and the same action as the run
it continues. So the card lock still holds — you can't resume a card another run is already
working on — and the resumed run can be resumed again if it fails too.

It **takes the place** of the run it continues: the row it started from disappears, marked
`resumed`, and the panel keeps one row for the work rather than a chain of dead attempts. That
also drops the old run's log, so read anything you want from it before you press the button.

Only a run that stopped short offers it. A run that passed has nothing to continue, and a run whose
conversation the agent can't reach (it never reported an id, or a different agent is picked
now) shows no button rather than one that could only fail. If the conversation itself has
expired, the resume ends as a failed run with the reason in its log, like any other failure.

When the agent is Claude Code, the server runs it with `CLAUDE_CODE_MAX_RETRIES=0`. Claude Code
normally retries a rate limit with a long backoff, which would leave a run stuck for the best
part of an hour while the card stays locked. With retries off, a rate limit ends the run right
away and the board shows it failed. Note this is not a spend control: whether hitting your
plan's limit spills into paid extra usage is an account setting on claude.ai, not something
the CLI can turn off.

## Run it from source

Only if you're changing the UI itself. Build, then start the production server (not
`next dev` — run the app the way it ships):

```
cd kanban-ui
npm install                 # first time only
npm run build
PORT=7420 npm run start     # http://localhost:7420
```

To reproduce the exact `npx` package (standalone server): `npm run build:standalone` then
`node bin/kanban-ui.mjs`.
