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
open it: the full card body, its meta (track, modules, release, priority, ROI, blockers), its
open questions, and its buttons.

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

### The release a card ships in

A card can say which version it ships in. Open the card and the meta box has a **Release**
box next to Priority and ROI: pick a version and the card moves into it, pick **next** and
it comes back out. **next** is where a card with no release sits — wanted, but not promised
to a version.

The list you pick from is the open releases in `docs/kanban/releases.md`, in the order they
ship, with **next** last. There is nothing to type, so a version id can't be misspelled into
existence. Making a release is still a terminal job: `release new v1` in your coding agent,
and it shows up in the box. Your pick is written into the card file the moment you make it,
like priority and ROI, so the files stay the record.

In the **Queue** view each card carries its release beside its track, so you can see what is
promised to a version and what isn't without opening anything.

A board that plans no versions never sees any of this — no box on a card, no chip in the
queue. Nothing asks you to plan a release.

`releases.md` is a plain file you can edit, so a card can end up naming a version that is no
longer on the list. That card goes on showing what it says, marked **not on the list**, and
the box moves it onto a release that really exists.

### The setup bar

One bar sits between the header and the columns while something about the board is
unfinished. It shows for two reasons.

**Setup isn't done.** Installing scaffolds the board and writes `setup-checklist.md` — the
steps setup still owes you, one box each. The bar says how far setup got ("3 of 6 steps
done") and what comes next. When the next step needs the agent, it hands you the line to
paste into your coding agent, with a **Copy** button:

```
/kanban. Set up this board — follow docs/kanban/setup-checklist.md.
```

The UI never runs setup itself — you paste that line, and the bar moves as boxes tick.
Setup picks up at the first unticked box, so the same line restarts it wherever it stopped.
The last box creates your first cards and deletes the checklist; the bar goes away at the
same moment the cards appear. Before that the skill creates no cards at all — ask it for
one and it tells you to finish setup first.

**The goal needs writing.** One of setup's steps is the project goal, and the bar gives
that one a **Write the goal** button instead of a line to copy. It opens a plain text
editor on `memory/goal.md` — your own words, the agent never drafts it for you; the file
holds the whole direction, horizon and roadmap included. Saving writes the file, ticks that
step, and leaves the `reviewed:` field to the agent.

Long after setup, the agent can judge the goal weak again (`reviewed: weak` in its
frontmatter — a missing file counts too). Then the same bar comes back with just that one
item, since every proposal the agent makes is judged against that file. It disappears once
the value turns `good` or `strong`.

The ✕ hides the bar for the browser session. The board works the same either way; the bar
is a nudge, not a gate. A board that is set up and simply has no cards left shows nothing —
empty columns aren't a signal, and neither is a board set up before the checklist existed.

## A card's buttons

Every button opens one small dialog. You can type a note that goes to the agent, then
confirm. The card then shows a running badge and a live log you can read while it works. The
log is read-only — you never type into a running session.

| Button | When it shows |
| --- | --- |
| **Implement** | Until every todo on the card is checked. Never on a group root. |
| **Refine** | While a refine would still move the card — see below. |
| **Edit** | Always. Say what to change and the agent revises the card. |
| **Resolve** | Only when the card has open questions. |
| **Archive** | Once every todo is checked (a group root: once every subtask is resolved). |
| **Reject** | Always. |

**Resolve** gives each open question an answer box. A question that carries choices shows
them as a tick list instead — one pick, or as many as you like, depending on the question —
with the agent's recommended ones already ticked, so agreeing is one click on the confirm
button. Those questions keep their box too: type an answer and the ticks clear, tick an
option and the text clears. Your answer is either the options or your own words, never
both. Leave a question untouched — nothing ticked, nothing typed — and the agent
researches that one itself. The card page lists the same choices under **open questions**,
so you can read them without opening the dialog.

**Resolve** has a second confirm, **Resolve & implement**: the agent answers the questions
it can settle itself, and if nothing is left for you to decide it goes straight on to build
the card in the same run. If a real judgment call remains, it stops and leaves it for you.

When a card is blocked, **Waiting on #&lt;id&gt; — still open** sits next to **Implement**, with a
link to each blocking card. The button still works: it's there so you know what you're
starting ahead of, not to stop you.

**Refine** runs one refine on this card right now, instead of waiting for the board to get
to it. Its dialog has nothing to type — it says what the agent will do, and you confirm. It
is the same run the board makes on its own (see **Auto-refine** below), so it works whether
that switch is on or off: the switch says whether the server refines cards by itself, not
whether you may ask for one.

The button shows only while a refine would still move the card. It's gone once the card is
**ready**, once every todo is checked, and when every open question is one only you can
answer — **Resolve** is the button for that last one. A **Blocked** card keeps the button;
the dialog names the blocker in one line and refines anyway.

A card can only have one run at a time. If the board is already refining this card, the
button is off and the badge beside the title says what's going on.

A run never commits. It leaves its changes in your working tree; you read `git diff` and
commit.

### Stopping a run

A live run's log has a small **✕** in its title bar. That ends the run — useful when an
agent is going the wrong way and you'd rather not wait for it. It's in every place the log
opens: the card page, the log you open from a card on the board, and **Runs** in the header.

The ✕ never stops anything on its own. It opens a small box asking you to confirm, so a
stray click on a busy board can't kill an agent mid-edit. Confirm and the button reads
**stopping…** for a few seconds: the agent is asked to end first, and only killed if it
doesn't go.

**Stop doesn't undo anything.** The run ends where it stands, and whatever it half-wrote
stays in your working tree — same as any other run. Read `git diff` and undo what you don't
want.

Every run can be stopped, whoever started it: one you pressed a button for, and one the
board started by itself. The card unlocks the moment the run ends, so you can start
something else on it.

**Stopped** is its own outcome, next to done and failed — a blue dot in the runs panel and
`stopped` on the log. Nothing went wrong, so it never reads as a failure, and it offers no
**Resume**: a run you ended is over, not one that stopped short.

If the board was auto-refining that card, stopping holds: it won't be picked up again a
minute later. Any later run on the card — a **Refine** you start, an **Implement**, an
**Edit** — lifts that and the board can pick it up again.

Stop ends the agent. A build or a test the agent kicked off is left to finish on its own.

### What a run cost

When a run ends, its log says how long it took, what it cost, and which model did the work:
`done · 4m 12s · est. $0.42 · claude-opus-5`.
The same line shows wherever that log opens — from the card, or from **Runs** in the header.

The number is an **estimate**, not a bill. The agent works it out on its own machine from the
run's tokens at list prices. Most people run the board on a subscription plan, where a single
run isn't charged on its own, so what you actually pay may be nothing at all.

It is one run's own cost. The board never adds runs up — not per card, not per day — and a
run you continued with **Resume** shows what that new run cost, not the whole conversation.

A run with no cost to report shows no number: one still going, one that failed, was
interrupted or was stopped before it got there, and an agent whose output says nothing about
cost.

### Which model a run used

The model comes from the run itself — what the agent said it was working with — not from the
model box in **Configuration**. So a run shows a model even when you left that box empty and
let the agent pick, and a run that started before you last changed the model still shows the
one it actually ran on.

It shows from the run's first seconds, so you can see what a live run is using, and it reads
exactly as the agent said it — the board never tidies up or invents a model name.

A run whose agent never named a model shows nothing there: an older run from before the board
tracked this, and any agent whose output doesn't say.

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
  about once a minute it picks the highest-priority cards that still need refining and runs
  a refine on each. It answers the questions it's confident about and
  leaves the real judgment calls for you as open questions. A card the board marks **Blocked**
  is passed over — its plan depends on a card that isn't built yet, so it waits until every
  blocker is archived or rejected, then gets picked up on a later pass. So is a card whose
  last run you stopped — see **Stopping a run**. With the switch off,
  no card is refined *on its own* — the **Refine** button on a card page still works. While a
  refine is running, **Refining #&lt;id&gt;** sits beside the switch and names every card it is
  on, background runs and ones you started alike; when nothing is running the label is gone.
- **Cards at once** — how many cards auto-refine works on at the same time. One by default,
  so nothing changes until you raise it, and 5 is as high as it goes. Each run takes a
  different card — the same card is never refined twice at once. More is faster on a big
  backlog and heavier on your machine and your rate limit. The number saves whether or not
  auto-refine is on; it's what the next run uses. A refine you start yourself never waits for
  a free slot, but it fills one while it runs, so the board starts one fewer of its own.

Settings live in `docs/kanban/ui.config.json`, next to your board — so `npx` always serves
the latest UI and an update never touches your settings. Everything the dialog holds writes
itself there:

```json
{
  "harness": { "name": "claude-code", "model": "claude-opus-5" },
  "autoRefine": false,
  "autoRefineParallelism": 1
}
```

`autoRefineParallelism` is a whole number from 1 to 5. Anything else — a 0, a negative, text,
a missing key — reads as 1, so a hand-edit that doesn't mean anything never breaks the board.

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

Only a run that stopped short offers it. A run that passed has nothing to continue, a run you
stopped yourself is over rather than short (see **Stopping a run**), and a run whose
conversation the agent can't reach (it never reported an id, or a different agent is picked
now) shows no button rather than one that could only fail. If the conversation itself has
expired, the resume ends as a failed run with the reason in its log, like any other failure.

When the agent is Claude Code, the server runs it with `CLAUDE_CODE_MAX_RETRIES=0`. Claude Code
normally retries a rate limit with a long backoff, which would leave a run stuck for the best
part of an hour while the card stays locked. With retries off, a rate limit ends the run right
away and the board shows it failed. Note this is not a spend control: whether hitting your
plan's limit spills into paid extra usage is an account setting on claude.ai, not something
the CLI can turn off.

## When it finds no board

Start the UI somewhere with no board and the page says **There is no board here**, and names
the folder it searched. It takes over the whole screen — there is nothing to show a header or
buttons for until a board exists. The terminal says the same thing when the server starts.

Two things it could be, and the page gives both:

- **This repo has no board yet.** Make one — run `npx ai4kanban install` in the repo root.
- **This is not the repo you meant.** Stop the UI and start it from your repo root, or point
  it at the repo: `npx ai4kanban-ui --board /path/to/repo`.

The UI never sets a board up for you. Install one in a terminal, switch back to the tab, and
the board is there — no reload.

A board that exists but has a card the UI can't read is a different thing: that board still
opens, with the error in a strip above it.

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
