<div align="center">

# AI4Kanban

### AI project management that grows with you.

A Kanban board that plans autonomously, shaped by every decision.

**English** · [简体中文](README-zh.md)

[Website](https://ai4kanban.dev) · [Quick start](#quick-start) · [Roadmap](#roadmap)

<img src="https://cdn.ai4kanban.dev/og-image-v4.jpg" alt="AI4Kanban — AI project management that grows with you" width="720">

</div>

## Kanban Engineering

Coding agents can already turn clear requirements directly into code. As a project moves
into continuous iteration, however, the bottleneck shifts upstream to project management:
deciding what to do next, turning vague ideas into actionable requirements, and managing
tradeoffs, dependencies, and schedules across tasks.

A codebase preserves implementation outcomes, but not the reasoning behind decisions or
the directions that were explicitly ruled out. Chat windows work well for one-off tasks,
but struggle to carry the context that accumulates over the life of a project. Without
that context, both people and agents can get lost in the details during the long journey
from an initial version to a mature product.

Kanban Engineering brings goals, tasks, decisions, and execution status together on one
board, with AI handling project management: proactively proposing requirements, refining
them in a loop, breaking down and prioritizing work, planning releases, and moving tasks
through their entire lifecycle. People remain responsible for product direction, taste,
business judgment, and final approval. AI4Kanban is an open-source implementation of this
way of working.

## What it does

Everything checked below is available today.

- [x] **Proposes work proactively.** The agent selects a module, draws on its code and
  accumulated module memory, and proposes unplanned features as concrete pieces of work.
- [x] **Builds project memory.** Decisions that will inform future planning are filed
  under the relevant module. Reasons for rejecting an idea are preserved as well, so
  similar proposals do not keep resurfacing.
- [x] **Refines requirements in a loop.** The agent reviews a requirement and raises
  questions. It makes decisions on its own when project memory and common sense provide
  enough context, and asks you only when they do not. The loop continues until the work
  is ready to begin or only decisions that require your input remain.
- [x] **Keeps work moving on its own.** Every run that writes or changes a card is
  followed by a refine of that card, started as a separate run you can watch and stop.
  Finishing or rejecting a card refines whatever it was holding up. Cards still blocked by
  other work wait until their dependencies are complete.
- [x] **Breaks down tasks.** The agent divides a requirement into subtasks and separates
  unrelated requests into their own cards.
- [x] **Manages dependencies and priorities.** The agent identifies dependencies,
  weighs value against cost, and uses both to determine the order of execution.
- [x] **Preserves the decision trail.** Each card records how the requirement was
  refined and which judgments the agent made independently. Completed tasks remain
  archived in Git.
- [x] **Plans releases.** Optional. Assign cards to a release to see its scope and how
  many tasks are ready to begin.
- [x] **Manages the complete lifecycle.** AI4Kanban covers proposal, clarification,
  execution, and archival, so the board always reflects the project's actual progress.
- [x] **Runs recurring tasks.** Keep periodic reports, external checks, and other
  repeated work as persistent cards. New boards also include a memory-cleanup card by
  default. Run them on demand or on a schedule; every run is timestamped, but the cards
  are never archived.

AI4Kanban is designed for small teams. It does not make product-direction decisions for
you. Instead, it shifts your work from writing requirements one by one and supervising
execution to assessing value and approving results. As its module memory grows, the agent
can make decisions based on the project's own constraints and preferences, ask fewer
repetitive questions, and avoid directions that have already been rejected.

## How it works

- [x] **Not tied to a single agent.** The board is decoupled from agent runtimes. Claude
  Code and Codex are supported today, with Cursor and other environments
  on the roadmap.
- [x] **Local first.** Cards are stored as Markdown files by default, with no MCP server
  or database required, reducing token usage. Everything is plain text in Git, so it can
  be reviewed, diffed, and rolled back.
- [x] **Works out of the box.** Download the app, or one prompt. AI4Kanban focuses
  exclusively on project management, so there is almost nothing to configure.
- [x] **Three ways to interact.** Press a button in the board app, type the `akb` command
  yourself, or add the optional skill and drive the same board from your coding agent.

The board is not an add-on interface. It is the agent's long-term project context, with a
clear place for goals, tasks, decisions, dependencies, and progress. AI4Kanban is not
centered on a chat window; the board is the agent's project-management interface.

## Quick start

### 1. Download the board app

**[Download AI4Kanban →](https://ai4kanban.dev/download)** — nothing to install first: no
Node, no npx, no terminal. macOS, Windows and Linux.

No build is signed yet, so the first open takes a few extra clicks. On macOS: drag the app
in from the `.dmg`, double-click it and click **Done** on the warning that it cannot be
checked, then open **System Settings → Privacy & Security → Security**, click **Open
Anyway** next to the blocked app, and **Open Anyway** once more when it asks. Every launch
after that opens straight away. On Windows click **More info** → **Run anyway**; on Linux
`chmod +x AI4Kanban-*.AppImage` and run it. The
[download page](https://ai4kanban.dev/download) spells each one out.

Open it, point it at your project folder, and it asks the three things only you can
answer — one to a screen, everything prefilled, nothing to paste: what the project is and
the tracks its work falls into, your project goal, and which agent runs the board.

![The guided first run in the board app](https://cdn.ai4kanban.dev/ai4kanban-first-run-v1.jpg)

Then press **Finish setup** and the board works down the rest itself: it reads your
codebase, establishes module memory, maps the project's modules, and creates the first ten
task cards. Starting runs needs your coding agent — Claude Code or Codex — on the machine,
same as from a terminal.

### 2. Or set it up from a terminal

Everything the board does is one command, `akb`. Install it, then scaffold the board from
your project root:

```bash
npm install -g ai4kanban
akb install --tracks feature,bug,research
```

`akb install` creates the board under `docs/kanban/` and writes nothing else — pass the
tracks your work actually splits into. What is left is the part that reads your repo and
thinks, so hand it to a coding agent that can run shell commands, from the project root:

```
Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.
```

It works down the same checklist the app's **Finish setup** button does, and answers the
same three questions on the way. A board set up either way is the same board: the same
files, the same checklist.

Don't want a global install? Every `akb <command>` in this README also works as
`npx --yes ai4kanban@latest <command>` — the same command, fetched each time.

If the agent cannot access the URL, open
[`INSTALL_PROMPT.txt`](web/public/INSTALL_PROMPT.txt) and give it the contents instead.
The result is the same. The only prerequisite is Node.js 18+; no other dependencies need
to be installed.

## Drive the board from your coding agent (optional)

Nothing above installs a skill, and the board runs fine without one. Add it when you want
Claude Code or Codex to work the same board from a chat — proposing tasks, refining them,
and implementing them in the session you are already in, instead of pressing a button and
watching a run:

```bash
akb skill install
```

That writes one short note per agent — into `.claude/skills/kanban/` (Claude Code) and
`.agents/skills/kanban/` (Codex) — saying the board is here and that `akb` owns it. Nothing
else is copied in: the flows the agent works by ship inside `akb`, so updating the command
updates every project at once. The board app does the same thing from a button
(**Configuration → Skill**).

## Using the board

Three ways in, and they land the same thing: press a button in the board app, say it to
your coding agent, or type the `akb` command yourself.

| You say | The agent does |
| --- | --- |
| "what's next?" / "propose new tasks" | selects a module, reads its memory, and drafts cards for unplanned work; creates 3 by default |
| "read this article and create tasks" | extracts user problems, validates them by module, and creates only work that is not already supported or planned |
| "add a task: …" | evaluates the idea, then creates a card and adds it to the index |
| "refine #4" | refines card #4 from a vague idea into something more concrete |
| "auto-refine #4" | keeps refining card #4 automatically until only decisions that require your input remain |
| "resolve #4" | works through the open questions on card #4 one by one |
| "review the board" | checks whether cards are clear, duplicates, already complete, or no longer worth pursuing |
| "implement #4" | implements card #4 and completes its checklist |
| "#4 is done" | updates the relevant documentation, then archives the card |
| "reject #4" | deletes the card and records the reason, so similar proposals do not return |
| "add a recurring task: …" | creates a recurring task that is never archived; say "run #4" to run it once |
| "create release v1" | plans a release; you can then use "put #4 in v1", "what's in v1?", and "close v1" |

Everything the board app's buttons do can be asked for the same way — the agent runs the
matching command and lands exactly what the button lands:

| You say | The agent does |
| --- | --- |
| "build #4 in the background" | starts a run on card #4 and returns; the run outlives the session |
| "what's running?" | lists the runs in flight and the ones that ran lately |
| "show me that run's log" | tails the run's log, or follows it as it goes |
| "stop it" | ends the run; its half-finished edits stay in the working tree |
| "that run died — carry on" | continues the same conversation instead of starting over |
| "use Codex instead" / "switch to Opus" | picks the agent, its model, and how hard it thinks |
| "check my setup works" | sends one small chat through and says what came back |
| "save my API key" | hands **you** the line to type — a key never passes through the agent |

The table uses English examples, but instructions in Chinese work as well.

See the [daily loop guide](docs/guides/daily-loop.md) for the complete workflow.

This repository also uses the board to manage its own development. `docs/kanban/` is a
real, active board that you can explore as a complete example.

### The commands you type

The same work, started by hand. `akb` puts an agent on a card without a chat session and
without a browser — over ssh, in a script, or in a second window while you work.

```bash
akb implement 12              # build the card
akb refine 12                 # sharpen it until it is ready to build
akb resolve 12                # answer its open questions
akb revise 12 "drop the CSV"  # change what the card says
akb create "add dark mode"    # write the card(s) for it
akb propose                   # write the next tasks
akb archive 12                # finish it
```

Add `--print` to any of them and nothing starts: it prints the steps instead, filled in for
this board — the card's own path, what it has left to do, the memory file the note goes in,
the command that closes the job. That is how an agent already in a session does the job
itself, in the conversation it is already in, instead of starting a second one to do it.

```bash
akb implement 12 --print      # the steps, for whoever is asking
```

The run keeps working after the command returns — close the terminal and the agent carries
on. Watch it, or stop it, from anywhere:

```bash
akb runs                      # what is running, and what ran lately
akb log 3f2a1b04 --follow     # watch a run as it goes
akb stop 3f2a1b04             # end one
akb resume 3f2a1b04           # continue one that failed
```

A run started in a terminal is the same run the app shows, and the other way round: one
list, one card at a time, and either side can stop or continue what the other started.

Which agent runs them, and what it is set to, is one command:

```bash
akb agent                     # what runs, and how it is set up
akb agent list                # the agents it can run
akb agent use codex           # pick one
akb agent set model gpt-5.1-codex
akb agent set apiKey sk-…     # saved to docs/kanban/.env, never shown back
akb agent test                # one small chat, to see it works
```

Runs use these settings, never what your shell happens to export — so the same command
means the same thing wherever you type it. `akb help` lists everything.

`akb` is also what a coding agent reads to know how the board works. `akb <action> --print`
hands it the job filled in for your board, and `akb guide` carries the flows themselves —
how a card is refined, how a release is planned, what goes in memory. Those ship with the
command, so a newer `akb` upgrades every flow at once and no project keeps a copy that falls
behind. What lands in your repo is a short note telling the agent to ask.

Beneath all of it sits `akb board` — the bookkeeping that owns ids, a card's frontmatter,
and the index. You never type one of those; the agent does.

### The board app

**[Download it →](https://ai4kanban.dev/download)** — the first step of the
[quick start](#quick-start), and what most of this is easiest to do from.

The board UI uses the same Markdown files as its single source of truth and provides both
Board and Queue views. You can read complete cards and the project goal, create tasks or
ask the agent to propose them, plan releases, run agents, schedule recurring tasks, and
review progress from the last 30 days. The Markdown files always remain authoritative.

It asks which project folder to open the first time and remembers it. Starting runs still
needs your coding agent on the machine, same as from a terminal.

| System | Build | Signed | Tested |
| --- | --- | --- | --- |
| macOS (Apple Silicon, Intel) | `.dmg` / `.zip` | no | yes |
| Windows | `.exe` installer | no | no |
| Linux | `.AppImage` | no | no |

macOS is the one we test each release; Windows and Linux are published untested. No build
is signed yet, so every system warns the first time you open it — what to click is in the
[quick start](#quick-start), and the [download page](https://ai4kanban.dev/download) spells
each step out.

![The board view in the Web UI](https://cdn.ai4kanban.dev/ai4kanban-ui-v4-board-view.jpg)

![The queue view in the Web UI](https://cdn.ai4kanban.dev/ai4kanban-ui-v4-queue-view.jpg)

What the buttons do: [kanban-ui/](kanban-ui/README.md).

<details>
<summary>Running it in a browser instead (deprecated)</summary>

```bash
npx ai4kanban-ui        # deprecated — http://localhost:7420, localhost only
```

Deprecated as of the release that shipped the app. It keeps working and the package is
frozen rather than pulled, so an existing setup still comes up — but no release lands there
again. The pages themselves are not going anywhere; the app is those same pages in a
window. What is deprecated is asking you to start a server and open a browser.

</details>

## Roadmap

- [ ] **Pluggable storage** (soon): store the board in Obsidian, Notion, or GitHub Issues.
- [ ] **More agent runtimes** (in progress): Claude Code and Codex are supported
  today, with Cursor next.
- [ ] **Git worktrees** (soon): run multiple tasks in parallel, each in an isolated
  worktree.
- [ ] **External input connectors** (soon): bring in user feedback, competitor research,
  and industry signals through webhooks, then turn them into tasks the board can evaluate.
- [ ] **Blocked-task management** (soon): split, rewrite, or reject tasks that remain
  stalled for too long.
- [ ] **Team collaboration** (medium term)

## Updating

Two lines, and nothing else. A newer command:

```bash
npm install -g ai4kanban@latest
```

Then a repaired board, from the project root:

```bash
akb update
```

`akb update` adds whatever an older version never wrote to the board, refreshes the skill
note if you have one — it never adds one — and leaves your cards, config, and memory alone. It can't replace the command while it is
running, so when it is behind it says the first line instead of finishing quietly. There is
no third step: the flows ship inside the command, so a newer command is newer flows in
every project you have.

Or tell your coding agent:

```
Update ai4kanban in this project. Run `akb guide update` and follow it.
```

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute. Contributions are
welcome.
