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

The header carries seven things:

- **The goal** (the compass, on the left beside the folder path) — see below.
- **Board / Queue** — the two views above.
- **The release dropdown** — which version the board is showing, and where a release is
  started or dropped; see below.
- **Create task** — describe an idea in your words and the agent writes the card. The same
  dialog has a **Propose tasks** mode: pick a module (or let the agent pick one) and it
  proposes new tasks inside it. A **How many** row sets the count — 3 by default, 10 at
  most — and a **Boldness** row sets how big those tasks are: `safe` polishes what already
  works, `normal` is a feature each, and `bold` asks for a big leap each — a capability the
  module doesn't have at all. Every proposal is a single card a session can finish, never a
  group task.
- **Runs** — every agent session, live or finished. Open one to read its log. A finished run
  can be continued with a follow-up prompt; that starts a new run.
- **Daily progress** (the chart) — the last 30 days of the board, as a line each for
  completed, created, and rejected cards, with the totals above it. The numbers come from
  `docs/kanban/metrics.csv`, which the script keeps as you work; the view only reads it. A
  board with nothing recorded yet says so instead.
- **Configuration** (the gear) — see below.

### The goal

`memory/goal.md` is where the project is headed, in your own words. Every proposal the agent
makes is judged against it, so it is worth rereading now and then — and the small **compass**
on the left of the header, after the folder path, is how. It sits on the board and on a card
page alike.

Click it and a **Goal** dialog shows the whole file, headings, paragraphs and roadmap as you
wrote them. Nothing is cut short or folded away; a long goal scrolls.

**Edit** in that dialog swaps the text for a plain box, with Save and Cancel. Saving writes
your words back and leaves the frontmatter exactly as it is — `reviewed:` is the agent's
judgment, the words are yours — and the dialog shows what you just saved, with no reload.

The compass only shows when there is something to read. A goal that is missing or still the
seeded text has nothing to open, and the setup bar is what asks you to write it there.

### The release a card ships in

A card can say which version it ships in. Open the card and the meta box has a **Release**
box next to Priority and ROI: pick a version and the card moves into it, pick **next** and
it comes back out. **next** is where a card with no release sits — wanted, but not promised
to a version.

The list you pick from is the open releases in `docs/kanban/releases.md`, in the order they
ship, with **next** last. There is nothing to type, so a version id can't be misspelled into
existence — the header's dropdown is where a release is made. Your pick is written into the
card file the moment you make it, like priority and ROI, so the files stay the record.

In the **Queue** view each card carries its release beside its track, so you can see what is
promised to a version and what isn't without opening anything.

A board that plans no versions never sees any of this — no box on a card, no chip in the
queue. Nothing asks you to plan a release.

`releases.md` is a plain file you can edit, so a card can end up naming a version that is no
longer on the list. That card goes on showing what it says, marked **not on the list**, and
the box moves it onto a release that really exists.

### Showing one release at a time

The dropdown in the header says which release you are looking at. Pick one and **the cards
in every other release are hidden** — that is the point of it: you work on this version
without the rest of the backlog in the way. Both views obey it, so the columns and the
ready / not-ready halves regroup on the same cards.

**Blockers are the exception: every blocker stays on screen whatever you pick.** A blocker
is usually in the way of the very version you are planning, and a blocker is never out of
sight. You see it in the Blockers column, and at the top of the queue's halves, even when it
belongs to another release or to none.

**All releases** is the way back to the whole board, and where the board opens. Each entry
counts the open cards in it — "v1 (7)" — so you can see a version is nearly empty without
opening it. Those are the same numbers `release list` prints in your terminal.

A few more things it does:

- A **group task** shows whenever the root or any of its subtasks is in the release you
  picked. Neither view draws a subtask, so hiding the root would hide the whole group.
- **Create task** puts the new card in the release on screen, so it doesn't vanish the
  moment you write it. **Propose tasks** doesn't — it offers work nobody has planned, and
  that work stays at **next**.
- A release with **nothing open in it says so**, with All releases one click away, instead
  of looking like a broken board. Blockers on screen don't count: a blocker belongs to
  whoever it blocks.
- Your pick is remembered in your browser, per board, like the view switch. Nothing is
  written to the files, so a pick never changes what the agent works on — background
  refining still reads the whole board, and the progress chart still counts every card.
- If the release you picked is gone — you closed it, or edited `releases.md` — the board
  opens on All releases rather than hiding your cards behind a version that no longer
  exists.

### Starting a release

The dropdown's last entry is **New release**, on a board with five releases and on one with
none. It asks for a version id and nothing else — `v1`, `0.5.0`, `august`, whatever you call
your versions. That is all a release is: a name and a place in the order, which is the order
you made them in. The note you can write beside a version in `releases.md` is yours, and
nothing reads it.

Under the name box sits one toggle: **put the high-priority cards in**. It is on, and it
says how many cards that is, so you see the move before making the release. The fill is a
rule, not a judgment call — it looks only at the cards sitting at **next**, and a card goes
in on three tests: its priority is high, nothing open is blocking it, and it is not a group
root (a subtask is tested on its own). Nothing else is looked at, and it only ever adds — a
card already in a release stays where it is. Every high-priority card the fill would leave
behind is listed right there with the test it failed, so nothing is dropped silently. With
nothing at **next** to move, the toggle says so; turned off, the release is made empty. A
card that shouldn't have gone in moves back the way any card does — its **Release** box.

The board switches to the new release the moment it is made, so what you write next lands in
it — **Create task** puts a new card in the release on screen. With the toggle off it is
empty to begin with, so the "has no open cards" note is what greets you, with **All
releases** one click away; with the toggle on, the cards it moved are what you see.

A name the board can't take — one it already has, an empty one, **next**, or one that can't
be a filename — is refused with the reason under the box, and the dialog stays open so you
can fix the name where you typed it. Leaving without a name makes nothing and leaves the
board on the release it was already showing.

### Dropping a release

You gave up on the version — it will not ship. While the board is showing one release, the
dropdown offers **Drop that release**, under **New release**. It never fires on one click:
a dialog first says what happens and lists the open cards that go back to **next** — still
wanted, no longer promised to a version — and only confirming writes anything.

The result is exactly what `release drop v1` does in a terminal: the version comes off the
list with no shipped record, and the summary file in `docs/kanban/.release-summaries/` gets
one dated **Dropped** section — the cards archived under the version, and the open ones
sent back. Cards already archived stay archived; nothing written reads later as a shipped
version. Why you gave up is yours to write down if you want it kept — the board records
nothing about it.

**Closing a release is still a terminal job**: `release close v1` in your coding agent. It
writes down what shipped, sends the cards still open back to **next**, and prints output
worth reading. Renaming and reordering are terminal jobs too — `releases.md` is a short file
and a hand edit is how those work.

A board that plans no versions sees the dropdown saying **All releases** and offering **New
release**, and nothing more: no **next** entry, since **next** is the whole board there.
Nothing asks you for a version.

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

The line follows the agent you picked, because agents trigger a skill differently: on Codex
it reads `$kanban. Set up this board …` instead. Copy it and paste it as it comes.

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
cost — Codex is one, so a Codex run's log shows the duration and no dollar figure.

### Which model a run used

The model comes from the run itself — what the agent said it was working with — not from the
model box in **Configuration**. So a run shows a model even when you left that box empty and
let the agent pick, and a run that started before you last changed the model still shows the
one it actually ran on.

It shows from the run's first seconds, so you can see what a live run is using, and it reads
exactly as the agent said it — the board never tidies up or invents a model name.

A run whose agent never named a model shows nothing there: an older run from before the board
tracked this, and any agent whose output doesn't say — Codex never does, so a Codex run names
no model even with the Model box filled in.

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

The gear in the header opens the **Configuration** dialog. A sidebar on its left splits it
into two sections — **Agent** and **Auto-refine** — and a new group of settings joins as one
more entry there. It holds:

- **Agent** — pick the agent that every button spawns: **Claude Code** or **Codex**. It runs
  in your repo root. See **Running on Codex** below for what changes when you switch.
- **The agent's own settings** — under the agent rows, in the same section, sit the settings
  that agent takes. Each agent brings its own list, so the fields change when you pick
  another one. Claude Code takes these:
  - **Provider** — who pays for a run and where it goes: the **Claude subscription**, the
    **Anthropic API**, or an **Anthropic-compatible endpoint**. The pick decides which of the
    boxes below you see. See **Which provider a run goes through**.
  - **Endpoint base URL** — the address your gateway answers on. Only for the endpoint, and it
    has to be filled in before that pick will save.
  - **API key** — your Anthropic key, or the one your gateway issued. Only for the two
    providers that can take one. See **Keys** below.
  - **Model** — the model that agent runs with. Type an id, or leave it empty to let the agent
    use its own default.
  - **Reasoning effort** — how hard the model thinks on every run. Pick one from the list:
    Low, Medium, High, Extra high (xhigh), Max. Lower is quicker and cheaper, higher is
    slower and more careful. Leave it on **Agent's default** and the board passes nothing —
    the agent thinks however it thinks on its own.

  Codex takes two:
  - **Model** — the same box: the id Codex runs with, passed to it as `--model`. Leave it
    empty for its own default.
  - **OpenAI API key** — optional. Leave it empty and runs use the login your `codex` CLI
    already has. Fill it in and every run uses that key instead. See **Keys** below.

  Switching agents empties the fields — a Claude model id means nothing to Codex — and leaves
  your saved keys alone.
- **Test** — under those settings, a button that sends one tiny message through the setup you
  have saved and says whether it worked. On a failure it shows what the agent said. See
  **Testing the connection**.
- **Auto-refine** — its own section, holding a switch. Turn it on and the server refines
  cards in the background:
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
itself there, with one exception: a key goes to `docs/kanban/.env` instead, and never to this
file (see **Keys** below).

```json
{
  "harness": {
    "name": "claude-code",
    "provider": "subscription",
    "model": "claude-opus-5",
    "reasoning": "high"
  },
  "autoRefine": false,
  "autoRefineParallelism": 1
}
```

`autoRefineParallelism` is a whole number from 1 to 5. Anything else — a 0, a negative, text,
a missing key — reads as 1, so a hand-edit that doesn't mean anything never breaks the board.

`harness.name` is the agent. It decides everything about how that agent runs: the command,
the flags that make it stream its output into the live log, the env vars, and the flags the
**Resume** button uses, and how a prompt calls the skill. Two agents ship: `claude-code`, the
default, and `codex`. If the file names an agent this UI doesn't know, Claude Code runs and
the dialog says so — you are never moved to a different agent without being told.

Every other key in the block is one of the settings that agent takes. Each agent says which
settings it has and what each one is called, and the dialog draws that list — so the fields
you see always belong to the agent you picked, and a new agent is one entry rather than a new
box in the UI. Claude Code has four here: `harness.provider`, `harness.baseUrl`,
`harness.model` and `harness.reasoning`. Codex has one, `harness.model`. Their API keys are
settings too, but a key is never written to this file — keys have their own place (see
**Keys**).

`harness.provider` is who pays for the run and where it goes — for Claude Code, one of
`subscription`, `anthropic-api` or `endpoint`. Leave it out and the board picks for you:
`anthropic-api` on a board whose `.env` already holds an Anthropic key, `subscription`
otherwise. A value this UI doesn't know reads as that same default, so the dialog and the run
never disagree. `harness.baseUrl` goes with the `endpoint` pick and is the only setting the
board insists on: it won't save that pick without one.

`harness.model` is the model that agent runs with, passed to it as `--model <id>`. One model
for every button — there's no per-action model. Leave it empty (or leave the key out) and the
agent runs its own default; the board never invents an id for you. Nothing here checks the id:
a wrong one makes the run exit right away, and the reason is in that run's log.

`harness.reasoning` is how hard that model thinks, passed to it as `--effort <level>`. For
Claude Code the levels are `low`, `medium`, `high`, `xhigh` and `max` — the agent's own words,
not the board's, so another agent names its own. One level for every button, like the model.
Leave it empty (or leave the key out) and nothing is passed. Nothing here checks the level:
the dialog only offers the ones on the list, and a level you hand-write into the file that
the agent doesn't know makes it say so and run at its own default — that warning is in the
run's log.

A key no agent declares is left exactly where it is. Saving in the dialog writes the one
setting you changed and touches nothing else in the file — it's yours.

To run a custom binary of that agent, or add flags to it, add a `harness.command` by hand:

```json
{ "harness": { "name": "claude-code", "command": "/my/bin/claude -p --model opus" } }
```

`harness.command` is a path or flags **for the agent `harness.name` picked** — not a way to
run a different one. The harness always adds its own flags on top, and another agent's binary
would reject them. To run a different agent, pick it. The harness's flags never override one
you set yourself. If the override already names a setting's flag — a `--model`, say — it wins
and that setting is not added on top. One flag, one place it comes from, and the dialog says
the field isn't in effect, so a filled-in field never looks broken.

The settings and the override belong to the agent they were written for — one agent's model
id or endpoint means nothing under another's name — so switching agents in the dialog clears
the block and leaves the new agent's name alone in it.

Each run reads the setting once, when it starts — flipping the picker while an agent is
working changes what the next run spawns, never the one in flight. And each run records the
agent it ran under, so **Resume** only ever offers to continue a run the agent you have
picked can actually reach: switch agents and a run the old one started stops offering it,
rather than handing its id to a CLI that never heard of it.

### Running on Codex

Pick **Codex** in the Configuration dialog and every button spawns
`codex exec --json --sandbox workspace-write` instead. Nothing else about the board changes:
the same cards, the same buttons, the same files.

You need the `codex` CLI on your PATH, signed in — a ChatGPT subscription runs the board the
same way a Claude one does. **Codex 0.94 or newer**, which is when it started reading skills
from `.agents/skills/`; the board's install writes the skill there as well as into
`.claude/skills/`, so both agents find it with nothing to set up. (Resuming a run needs
`codex exec resume`, which has been there since 0.35, so the skills version is the one that
matters.)

Its two settings sit under the agent rows: a **Model** box, passed to Codex as `--model`, and
an optional **OpenAI API key** (`OPENAI_API_KEY`) — leave that empty and runs use the login
your `codex` CLI already has.

Four things read differently on Codex:

- **A run stays inside your repo.** `--sandbox workspace-write` lets it write in the working
  folder and nowhere else, gives it no network, and makes it refuse to start outside a git
  repo. If your work needs more than that, widen it yourself with a `harness.command` — a
  `--sandbox` you name there is the one that runs, and the board adds none on top.
- **A rate limit waits instead of failing.** Claude Code is run with retries off, so a limit
  ends the run at once and frees the card. Codex has no such switch: a rate-limited run sits
  there retrying, holding the card, until it gets through or gives up. Nothing on the board
  is stuck — every other card still works — but that one run may take a long while.
- **No cost.** Codex reports no price for a run, so its log shows the duration and nothing
  where Claude Code shows `est. $0.42`.
- **No model name.** Codex never names the model in its output, and the board shows what the
  run itself said rather than what the Model box holds — so a Codex log names no model, even
  when you filled that box in.

**Resume** works: Codex mints its own thread id, the board catches it from the run's first
event and keeps it with the session, and Resume continues that thread with
`codex exec resume <thread-id>`.

### Which provider a run goes through

Every run has to go through somebody's account. **Provider**, at the top of the Agent
section, is where you say whose. Claude Code offers three:

| Provider | What it is | What it needs |
| --- | --- | --- |
| **Claude subscription** | The login your `claude` CLI already has. | Nothing. |
| **Anthropic API** | Pay per token on an Anthropic key. | The **API key** box. |
| **Anthropic-compatible endpoint** | A gateway that answers in the Anthropic format — OpenRouter, LiteLLM, a company proxy. | The **base URL**; a key only if that gateway asks for one. |

**You only see the boxes your pick uses.** The subscription shows neither, the Anthropic API
shows the key, the endpoint shows both. The endpoint is the one pick the board won't save
without its box: type the base URL and the pick saves itself the moment it's there. A key is
never demanded — you can write one into `docs/kanban/.env` by hand at any time, so the board
doesn't treat an empty box as a mistake.

**Your pick decides the whole environment a run starts in.** It sets what it needs, and it
clears everything else that could send Claude Code somewhere: the other providers' variables,
and the ones for providers this board doesn't offer yet (Bedrock, Vertex, Foundry). So an
`ANTHROPIC_BASE_URL` you exported in your shell months ago can't quietly route a
**Claude subscription** run through a gateway while the dialog says otherwise. Your cloud
credentials themselves — `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS` and the like — are
left alone: they move nothing once the switch above them is gone, and the agent may need them
for the work it's doing in your repo.

**Changing your mind costs nothing.** The base URL and the key stay in their boxes when you
pick something else, so flipping between two providers never asks you to type either again.
Only what the new pick needs reaches the next run.

**Defaults keep an existing board running as it is.** A board that never picks anything runs
on the subscription. A board whose `.env` already holds an Anthropic key reads as the
Anthropic API instead, so the key it was already using goes on being used.

**There is no "OpenAI" entry, on purpose.** Claude Code speaks the Anthropic API and nothing
else. An OpenAI model reaches it through a gateway that answers in the Anthropic format —
that's the endpoint entry, with the gateway's own base URL. To run Codex on an OpenAI account,
pick Codex.

Codex has no provider list yet: it runs on whatever login its CLI has, plus the optional key
below, and its runs inherit your shell environment as they always did.

### Testing the connection

**Test**, at the bottom of the Agent section, answers one question: does this setup actually
run? Without it you only find out on the first card run that fails — the `claude` CLI isn't
logged in, the key was revoked, the gateway is down, the model id is wrong.

It sends one tiny message — "Reply with OK and nothing else." — through the agent, spawned
exactly the way a card run is: the same command, the same environment. So a test that passes
is a card run that starts. Nothing reads the answer; that the agent answered at all is the
pass.

**It tests what is saved**, not what you have half-typed. Every box in the dialog saves as you
change it, so the two are normally the same thing — the one exception is a provider pick still
waiting on a box, and Test stands down until that pick is saved.

What the panel under the button says:

- **Passed**, with how long it took.
- **Failed**, then the agent's own words — the same lines that agent's run log would show, and
  nothing written on top of them. "Not logged in · Please run /login", "API Error: 401 API key
  is invalid", "Unable to connect to API (ConnectionRefused)", "There's an issue with the
  selected model (…)". A guess laid over a real error message would only send you the wrong
  way, so there isn't one.
- **The CLI isn't installed** is the one case the board puts in its own words, because
  `spawn claude ENOENT` tells you nothing. It names the command that's missing and the command
  that installs it.
- **No answer after a minute** and the test gives up and reports that, so a dead endpoint never
  leaves the panel spinning.

A test costs a few tokens on a paid provider — the line beside the button says so. It is not
board work: no card is touched, no card is locked, nothing joins the queue, and it never shows
up in the **Sessions** panel. Close the dialog and the result is gone; it's a check you run
while you're looking at the setup, not a job the board keeps.

### Keys

Keys live in **`docs/kanban/.env`**, next to `ui.config.json`. That is the only place the
board keeps one — never `ui.config.json`, never a shell profile, never anywhere else.

There are two ways to set one, and they agree:

- Type it into the Configuration dialog and press **Save**. It lands in `docs/kanban/.env`.
- Or write the line in that file yourself:

  ```
  ANTHROPIC_API_KEY=sk-ant-…
  ```

Plain `NAME=value` lines, one per line. Blank lines and lines starting with `#` are skipped,
and a value in quotes is read without them. The board reads the file for *which* keys it
holds, so a key you write by hand shows in the dialog as set and works in the next run — no
restart, nothing to keep in step.

Saving from the dialog rewrites that one line. Every other line — a key the board doesn't
know, a comment, the order they sit in — is left alone. It's your file.

**The file is kept out of git.** `docs/kanban/.gitignore` carries `.env`, so the key can't
be committed. `kanban init` writes it when it makes the board — and adds it to an older
board when you re-run it — so a key you write by hand yourself is covered from the first
day. Saving from the dialog makes sure of it too. A `.gitignore` already there gets the
line added, not replaced. Commit that `.gitignore`; never commit the `.env`.

**A saved key is never shown back.** The box hides what you type, and once it's saved the
dialog says the key is set, with **Replace** and **Clear** beside it. The key is never on
screen, never in a run's log, and never on a command line.

**What a run gets.** When a run starts, the board sets the variables from `docs/kanban/.env`,
so what the dialog shows is what the run uses. On Claude Code the key goes out under the
variable its provider uses, and only that one: `ANTHROPIC_API_KEY` for the Anthropic API,
`ANTHROPIC_AUTH_TOKEN` for a gateway — which is what OpenRouter, LiteLLM and the rest read.
A gateway run also gets `ANTHROPIC_API_KEY` explicitly empty, because Claude Code reads a
key there as its own login and turns your claude.ai connectors off when it finds one. A key
belongs to the provider you picked: on the **Claude subscription** it isn't sent at all,
even when it's saved.

Each agent takes one key, and it is **optional** either way: Claude Code's is
`ANTHROPIC_API_KEY`, Codex's is `OPENAI_API_KEY`. Leave it empty and runs use whatever login
that CLI already has, which is how the board has always worked. Clear it and the next run goes
straight back to that login. The two keys sit side by side in the file — switching agents,
or providers, never touches either one, so a key you gave once is still there when you come
back.

### When a run fails or is interrupted

A run that stopped short — the peach dot in the sessions panel — shows a **Resume** button. It
sends one more turn into that same conversation (`claude --resume <id>`, or
`codex exec resume <thread-id>`, run for you), so the agent picks up where it stopped instead
of starting the task over. Nothing is copied and you never see an id.

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

Codex has no equivalent switch, so a rate-limited Codex run waits it out and holds its card
while it does — see **Running on Codex**.

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
