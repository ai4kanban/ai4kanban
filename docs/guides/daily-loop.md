# The daily loop

Once the board exists, you drive it in plain language. Here's the rhythm.

Everything you *say* below goes to a coding agent, which needs the skill in the repo —
`akb skill install`, or **Configuration → Skill** in the board app. A board arrives without
it. Every one of those asks is also a button in the app and a command you can type, so
nothing here is closed to a board that has no skill.

## Two ways the work gets done

Everything below happens one of two ways, and the difference is worth knowing.

**In the conversation you're in.** You ask your coding agent for a board action — "refine
#4", "#4 is done" — and it does the job itself, right there. It's already reading your
code, it has the context, and nothing extra is billed. If it takes a wrong turn, "not that
one" is your next message. Under the hood it asks the CLI for the steps with `--print`:
the CLI hands back what to do for *your* board — the card's own path, the steps it has
left, the memory file to write the note in, the command that closes the job — and the
agent follows it.

**Sent off as a run.** You press a button on the local board, or type `akb refine 4`, and
a second agent starts on its own. It keeps working when you close the terminal, it shows
in the runs panel with its own log, and you can stop it. Nothing you say reaches it while
it goes, so a correction costs the whole run.

Send it off when you want the work to happen while you do something else, or on the long
read-heavy jobs — proposing across the repo, planning a release, refining round after
round. Otherwise just ask, in the session you're already in. When your agent isn't sure
which you meant, it asks the CLI to print: that costs nothing and you can still say "no,
start a run".

A run never starts another run. An agent working inside one that's asked for a board
action gets the steps printed and does them itself, so one run can't quietly become five.

## Pick what to work on

Ask **"what's next?"**. The skill:

1. Reads the board, your published docs (where shipped work is recorded), `readme.md`
   (the index of shipped work — one line per behavior, linking to its doc), and
   `rejected.md` so it won't repeat work.
2. Scans your planning sources for real gaps.
3. Proposes **new tasks** from real gaps — not a pick from the existing pile. Three of
   them unless you ask for a different count (ten is the most it will write), each one
   short-term: a card a session can finish and you can feel right away.

You approve, tweak, or drop each. Approved ones become cards.

Every proposal is judged against `memory/goal.md` — the direction in your own words. The
file starts empty, and the skill never writes the goal for you. It only marks how clear
the goal looks in the file's frontmatter (`reviewed:`), and it re-marks it every time it
proposes:

- `strong` / `good` — clear enough to plan from.
- `pending` — you just wrote or edited the goal and nothing has read it yet. Written by
  the board itself when the goal is saved, so it never asks you for work you just did.
- `weak` — missing, empty, or too vague to plan from. This is the only value that makes
  the board ask you for a goal.

The board keeps working either way, but proposals are guesses until you write the goal.

## Talk it over first

Not every answer is a job. When you want to think out loud — what's worth doing next, what
a card actually means, whether two cards are the same card — open a conversation instead:

```bash
akb chat "what should I build next, and why?"
akb chat 241 "what is still unclear about this card?"
```

You explain nothing. A chat opens knowing what a coding agent knows after you type
`/kanban`: your goal, your modules, your tracks, every open card in one line, and — when
you name one — that card in full, with its questions and the cards it waits on. It knows
where your memory files are and reads them before it suggests anything, and it knows which
`akb` command answers which ask, so when the answer is work it hands you the line to run.

In the app the same conversation is a rail down the right of the window — **Chat** in the
header opens it, and it follows what you are reading: the board's chat on the board, a card's
on its page. It is one conversation either way, so you can start it in a terminal and carry it
on in the app.

Reach for it when:

| You want | Chat, or a run |
| --- | --- |
| to decide what to build, or why | chat — it is a question, not a job |
| to understand a card before you approve it | chat |
| to compare two cards, or spot a duplicate | chat |
| the card changed, or the code did | a run — `akb refine 4`, `akb implement 4` |

A chat changes nothing: no card, no memory file, no code. It also never shows in `akb runs`
and never holds a card, so it can't get in the way of work already going.

Two things to know. The board it was shown is the board as it stood when the conversation
started, so on anything that may have moved it goes and reads the card again rather than
answering from memory. And each conversation is separate and lives on your machine, under
`docs/kanban/.chats/` and out of git — `akb chat 241` picks yours up from any terminal,
`akb chat 241 --clear` starts it fresh on the board as it stands then.

## Plan a release

A release is a version you're planning — call it `v1`, `0.5.0`, or `august`; the board
never reads the name. Say **"create release v1"** and it joins the list in
`docs/kanban/releases.md`, in the order it ships. Say **"put #4 in v1"** and that card
ships in that version. A card you never place is in no release — wanted, but not promised
to a version.

Say what the version is for while you make it: **"create release v1 — the first version
worth showing someone"**. Those words sit on the release's own line in `releases.md`, so
you and the agent can both say what this version is trying to ship, and `release list`
prints them under each version. Say **"v1 is for …"** to change them later. The goal is
never required — a release made without one works everywhere one with a goal does.

Say **"plan release v1"** and the agent fills the version against its goal: it moves the
open cards that ship the goal into the release, and it writes the cards the goal needs that
your board hasn't got. The new cards land plain, and each one is refined right after, as a
run of its own. It decides on its own — nothing waits on you — and it ends by saying what it moved in, what it
wrote, and what it left out and why. A card already in another release stays where it is, so
planning only ever adds: run it again whenever the goal changes and it adds what the goal
still lacks. To take a card back out, say **"take #4 out of v1"**.

A release with **no goal** has nothing to plan against, so it falls back to a plain rule.
Say **"create release v1 and fill it"** and the unplaced high-priority cards go in as the
version is made: a card goes in when its priority is high, nothing open is blocking it, and
it is not a group root — a subtask is tested on its own, and a card already in a release
stays where it is. Every card that moved is named, and every high-priority card left behind
is named with the test it failed, so you read the plan instead of guessing it.

On the local board, the New release dialog asks which kind of release this is with two tabs:
**From a goal**, where the goal box is the whole choice and the release can't be made until it
says something, and **No goal**, which has no goal box and applies the plain rule instead,
counting the cards it would put in. The **⋯** beside the dropdown offers **Fill from its goal**
on a release that already exists, so a release made without one can be given a goal later and
filled from there. Planning is an ordinary run: it shows in the runs panel the moment the
release is made, you can stop it, and its log is where you read what it did. While it goes the
board says the release is being planned, and the cards it moves in appear as it writes them.

Say **"what's in v1?"** and you get every release in ship order, each with what it is for,
how many cards it holds and how many are ready to build — the cards in no release counted
last. So the work you promised for this version sits on the same screen as the work nobody
promised.

On the local board, the New release dialog's **From a goal** tab asks for the goal under the
version id, the release dropdown shows it under each version, and the **⋯** beside the
dropdown opens the whole goal — that is where you change it.

Releases are optional. Nothing asks you for one, and a board that never plans a version
works exactly as it does without them.

## Close a release

The version shipped. Say **"close v1"**. The skill writes what the release held to
`docs/kanban/.release-summaries/v1.md` — what shipped, from the cards you archived while
they named it, and what didn't — clears the release off every card still open in it, and
takes the version off the list. `releases.md` only ever shows what's still ahead.

You can close whenever you say the version shipped, however much is still open. Afterwards
the id is gone: putting a card in `v1` fails like a typo, and the next version is a new
release. A card whose todos are all ticked but which you never archived counts as not
shipped — the skill names it so you can archive it and fix that line in the summary.

On the local board, the ⋯ beside the release dropdown offers the close while you're looking
at that version. It shows you what the close records and which open cards come out of the
version before you confirm, and it names the ticked-but-never-archived cards there — early
enough to cancel, archive them, and close after.

The summary keeps what the version was for: the line in `releases.md` is gone, so those
words survive only there. The rest of it is a list of cards, not a changelog. Not every
change goes through the board, so only you can say what the version changed — the summary
is your source for writing that.

## Drop a release

You gave up on the version — it will not ship. Say **"drop v1"**. The version comes off
the list with no shipped record. It reports the cards already archived under it and the
open ones it sends back to no release, but writes no summary file or summary section. If a
close of the same id left a summary earlier, that file stays untouched. On the local board,
the ⋯ beside the release dropdown offers the drop while you're looking at that version and
shows both groups of cards before you confirm.

The skill writes down nothing about the drop or why it happened. If the reason is worth
keeping, write it wherever you keep such notes.

## Add a task

Say **"add a task: <idea>"**. Before writing, the skill reviews the idea (business value,
feasibility, duplication) and checks `redesign.md` so it doesn't repeat a known design
mistake. Then it:

- allocates an id with `akb board create`,
- writes a self-contained card in plain language, split into checkable todos,
- adds it to `todo/README.md` under its track.

## Turn a source into tasks

Say **"read this article and create tasks"**, or give the skill research, an analysis, or
user feedback. It treats the material as evidence rather than a ready-made task list.

The skill extracts concrete user problems, finds the project modules that could improve
them, and validates each idea against the goal, code, docs, module memory, and open cards.
Work is checked in parallel by module, then reconciled before any ids are allocated. Ideas
that are already supported, already planned, previously rejected, outside the project's
control, or too weak to justify are skipped. A useful detail for existing work updates
that card instead of creating a duplicate.

The result can be fewer tasks than the source suggests — including none. Each card that
does survive is about the product improvement and user value, not about reading the
source.

## Push a card forward

Say **"refine #4"**. The skill first reviews the card (missing steps, missed edge cases,
over-complication, actionability), then rewrites it one stage toward concrete — one stage
only, stopping before code-level detail — and writes the result back into the card.
Decisions only you can make land on the card as open questions.

A card with open questions can't be refined again. Say **"resolve #4"** — the skill
researches each question, decides the ones the evidence settles, asks you the real
judgment calls, and clears the list.

You rarely have to ask. Any run that writes or changes a card is followed by a refine of
that card, started on its own once the run ends — so a card you add, revise or resolve comes
back refined without a second instruction. Archiving or rejecting a card does the same for
every card it was holding up. Each one is an ordinary run: you can watch its log and stop
it. What has nothing to refine is skipped — a card still blocked (schedule that one, below),
one already ready, a
recurring card, one whose todos are all ticked, and one waiting only on your answers. A
group's main card is skipped too when a subtask finishes — ticking its line is progress, not
a new plan — so a big group doesn't refine its main card once per subtask.

## Let a specialist fill part of the spec

Some parts of a card nobody should plan by guess — the screen a feature puts in front of
the user, the outside library a feature leans on. Those go to a **spec agent**: a named
agent that owns one part of a card's spec and fills only that part.

The board ships two, and `akb spec` lists them:

- **`ui-design`** — draws the screen a card needs. Its answer is two or three mockup files,
  one layout each, that the card page draws as pictures of the screen — with one line under
  each saying what it is good for and what it costs, and one of them recommended. You pick by
  looking, not by reading a description. Run it again on the same card and it draws over its
  old mockups and clears away the ones it no longer uses.
- **`technology-selection`** — picks the library, tool, or service a card leans on: two or
  three candidates, what each gives you and what it costs, one recommended. Keeping what
  the project already uses and writing it yourself are candidates too, so a card doesn't
  come back with something new to install by default. It looks each one up before naming
  it, so a package that was renamed or abandoned never reaches the card.

### Picking a layout by looking at it

A card that changes a screen can carry **mockups** of it — small files under
`docs/kanban/.mockups/<card id>/`, each drawing one layout the card could take. The card body
points at each one with a short tag, and the card page draws the screen that file holds where
the tag sits, so you pick a layout by looking at it instead of by reading a description of it.

A mockup is a `.tsx` component styled with Tailwind, or a plain `.html` page. Either way it
gets the same frame on the card: one desktop screen scaled down to fit, its label and its file
name across the top, and a switch to the code behind it. The file name opens that mockup on
its own at full size, where the words in it can be read; Back returns to the card.

Nothing in a mockup runs, loads anything, or answers a click — it is a drawing of one screen
in its normal state, and it is thrown away when the build starts. A tag pointing at a file
that isn't there, or at one the board can't draw, reads as one plain note naming the file, and
the rest of the card draws as usual.

The folder is gitignored, so mockups stay on the machine that drew them: a card you pull from
someone else carries the tags without the pictures, and running `ui-design` again draws them
back. What a layout settled is in the card's own words, which is what travels.

It is a run like any other — its own log, stoppable — with three things that make it
different:

- **It starts clean.** It is given the card and a short note, never the conversation that
  asked for it. That is the point: a second opinion, not an echo.
- **It writes one section and nothing else.** The section carries its name —
  ``## By `ui-design` agent`` — so you can see who is answerable for that part of the
  spec. Run it again and that section is rewritten, never doubled. The rest of the card —
  your summary, the scope, the todo list — is closed to it, and every other flow leaves
  its section alone in return.
- **Nothing waits for it.** A planning flow asks for one and carries on; the board starts
  it the moment that flow's run ends, and the section arrives on the card when it is done.
  When the answer is a pick only you can make, it leaves an open question beside its
  section instead of choosing.

You rarely ask for one yourself — the flow working the card asks when the card needs it.
When you do want one: **"put the ui-design agent on #4"**, or `akb spec ui-design 4`.

### When one shows up on its own

Most spec runs in the panel are ones you never typed. The flow working the card asked for
them, and the board started them:

- **After adding a card** — the flow that wrote the card asks for whatever part of the spec
  it would otherwise have guessed at.
- **After a refine** — only when that part of the spec is still open: the card changes a
  screen and only describes it, or leans on a library nobody picked. A refine that sharpened
  the wording or re-ordered the todos asks for none.
- **After a revise** — only when your change moved the screen the card draws or the library
  it picks.
- **After a propose or a release plan** — never from the run itself. Those write rough cards
  in bulk; each card's own refine follows, and that is what asks.

So a card that needs neither a screen nor a library goes through every one of those without
a spec run, and nothing tells you it did — that is the normal case, not a miss. A card that
already carries an agent's section is not sent back to it unless the plan under it moved,
and the board turns down a second ask while that agent is still working the card.

### Switching one off

The board app lists the spec agents in **Configuration → Agents**, each with one switch. An
agent you switch off is greyed and reads **off**, and the board starts no new run of it, on
any card: it leaves the list a planning flow picks from, and a flow that asks for it by name
plans that part of the card itself instead. The switch is saved with the board, so it holds
across restarts, reads the same for everyone working on it, and applies to a flow run in a
terminal as much as to a button. Whatever an agent already wrote on a card stays there, and
switching it back on has the next flow calling it again.

## Queue a card that is waiting on another

A card whose `blocked_by` still names an open card can be built or refined anyway — the
board warns, it never stops you. It can also wait properly: schedule the action, and the
board runs it by itself the moment the last card in its way leaves the board, archived or
rejected alike.

```bash
akb board schedule 4 --action implement --notes "start with the parser"
akb board schedule 4 --action refine
akb board schedule 4 --clear
```

In the local UI it is the **Schedule** button beside **Implement anyway** in the Implement
dialog, and beside **Refine anyway** in the Refine one.

- A card holds **one** schedule at a time; a second replaces the first.
- It reads **pending** in place of its stage until it fires — the card keeps its stage and
  its place on the board.
- It fires **once**, within a minute of coming free, and the mark comes off as the run
  starts. A run that fails or is stopped doesn't come back on its own.
- A schedule that has gone pointless is dropped rather than run — a refine queued on a card
  that has since reached `ready` has nothing left to do.
- The mark lives in the card's own frontmatter, so it survives a restart and travels with
  the card.

Scheduling the refine is the answer to the refine that gets skipped: a card still blocked is
passed over, because sharpening a plan whose foundation could still change shape is work you
throw away. Queue it and it happens at the right moment instead.

## Review the board

Say **"review the board"** (or "review #4"). The skill checks cards for plain language,
split todos, duplication, and whether any are already done or no longer worth it. It
archives finished ones and flags the rest.

## Finish a task

Say **"#4 is done"**. The skill updates the published doc the change touched (via the
card's doc todos) and adds one line to `readme.md` — a link to that doc, or a short
plain-words note when no doc covers the behavior yet — then runs `akb board archive 4`
to take the card off the board and record the metric.

```bash
akb board archive 4
```

The card file isn't deleted — it moves to `docs/kanban/.archive/`, which stays in git. So
you can still read a finished card, or diff it, long after it left the board.

## Reject an idea

Say **"reject #4"** (rare). The skill adds a one-line "why not" to `rejected.md` and runs
`akb board reject 4`. Future loops won't re-propose it.

## Keep it lean

Over time the memory set — `readme.md`, `decisions.md`, `rejected.md`, and
`redesign.md` — grows. Ask the skill to **prune** it — it compresses each to
planning-useful summaries grouped by topic, so scans stay cheap. The board itself stays
small because finished work is a note, not a card.

## Driving a run, and the agent behind it

Everything above is a card. The rest of what the board app's buttons do can be asked for
just as plainly, and your agent runs the matching command:

| You say | What runs |
| --- | --- |
| "build #4 in the background" | `akb implement 4` — starts a run and returns |
| "what's running?" | `akb runs` |
| "show me that run's log" | `akb log <run>`, `--follow` to watch it go |
| "stop it" | `akb stop <run>` |
| "that run died — carry on" | `akb resume <run>` |
| "use Codex instead" | `akb agent use codex` |
| "switch to Opus" / "make it think harder" | `akb agent set model …`, `akb agent set reasoning high` |
| "check my setup works" | `akb agent test` |
| "save my API key" | it hands **you** `akb agent set apiKey <key>` to type yourself |

A key is the one thing your agent hands back instead of running: a key it types lands in
its transcript and in your shell history, and the board never reads a saved key back.

When an ask can't run, the answer names the one line that fixes it — `akb install` for a
project with no board, `npm install -g ai4kanban@latest` for an `akb` that is behind,
`akb agent test` for an agent that isn't installed, `akb agent` for a key or provider that
isn't set.

## The commands, for reference

Only `akb board` allocates ids or touches metrics — never edit `next-id` or `metrics.csv`
by hand.

```bash
akb board create [--count N]      # allocate ids
akb board release new v1          # plan a version
akb board release new v1 --goal ".."  # …saying what it is for
akb board release new v1 --fill   # …with the high-priority cards in
                                  # (filling from the goal is a run: "plan release v1")
akb board release goal v1 ".."    # change what it is for
akb board release list            # what each version holds
akb board release close v1        # the version shipped
akb board release drop v1         # the version will not ship
akb board schedule <id> --action implement|refine
                                  # run it by itself once the card comes free
                                  # (--clear takes the schedule off)
akb board archive <id>            # finish a task
akb board reject  <id>            # drop an idea
akb spec                          # the spec agents, and what each one fills
akb spec <agent> <id> [note]      # put one on a card — its own run, starting clean
akb chat "<message>"              # talk about the board — changes nothing
akb chat <id> "<message>"         # talk about one card
akb chat [<id>]                   # the conversation so far
akb chat [<id>] --clear           # forget it and start fresh
akb board peek                    # next free id
akb board metrics                 # the daily CSV
akb board help                    # full usage
```

The flows themselves — how a card is refined, what goes in memory, how a release is
planned — ship with the command too: `akb guide` lists them, `akb guide board` is how the
board works at all. Your project keeps only a short note pointing there, so `akb update`
upgrades every flow at once.
