# The daily loop

Once the board exists, you drive it in plain language. Here's the rhythm.

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

## Plan a release

A release is a version you're planning — call it `v1`, `0.5.0`, or `august`; the board
never reads the name. Say **"create release v1"** and it joins the list in
`docs/kanban/releases.md`, in the order it ships. Say **"put #4 in v1"** and that card
ships in that version. A card you never place is in no release — wanted, but not promised
to a version.

Say **"create release v1 and fill it"** and the unplaced high-priority cards go in as the
version is made. The fill is a rule, not a judgment call: a card goes in when its priority
is high, nothing open is blocking it, and it is not a group root — a subtask is tested on
its own, and a card already in a release stays where it is. Every card that moved is named,
and every high-priority card left behind is named with the test it failed, so you read the
plan instead of guessing it. On the local board, the New release dialog carries the same
move as a toggle, with the count of cards it would put in.

Say **"what's in v1?"** and you get every release in ship order, each with how many cards
it holds and how many are ready to build — the cards in no release counted last. So the
work you promised for this version sits on the same screen as the work nobody promised.

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

The summary is a list of cards, not a changelog. Not every change goes through the board,
so only you can say what the version changed — the summary is your source for writing that.

## Drop a release

You gave up on the version — it will not ship. Say **"drop v1"**. The version comes off
the list with no shipped record: the summary file gets one dated `## Dropped` section
listing the cards archived under it and the open ones sent back, and it says dropped,
never shipped. The open cards come out of the version — back to no release. On the local
board, the ⋯ beside the release dropdown offers the drop while you're looking at that
version, and shows you which open cards it moves before you confirm.

The skill writes down nothing about why. If the reason is worth keeping, it's yours to
write — in the summary file, or wherever you keep such notes.

## Add a task

Say **"add a task: <idea>"**. Before writing, the skill reviews the idea (business value,
feasibility, duplication) and checks `redesign.md` so it doesn't repeat a known design
mistake. Then it:

- allocates an id with `kanban.mjs create`,
- writes a self-contained card in plain language, split into checkable todos,
- adds it to `todo/README.md` under its track.

## Push a card forward

Say **"refine #4"**. The skill first reviews the card (missing steps, missed edge cases,
over-complication, actionability), then rewrites it one stage toward concrete — one stage
only, stopping before code-level detail — and writes the result back into the card.
Decisions only you can make land on the card as open questions.

A card with open questions can't be refined again. Say **"resolve #4"** — the skill
researches each question, decides the ones the evidence settles, asks you the real
judgment calls, and clears the list.

## Review the board

Say **"review the board"** (or "review #4"). The skill checks cards for plain language,
split todos, duplication, and whether any are already done or no longer worth it. It
archives finished ones and flags the rest.

## Finish a task

Say **"#4 is done"**. The skill updates the published doc the change touched (via the
card's doc todos) and adds one line to `readme.md` — a link to that doc, or a short
plain-words note when no doc covers the behavior yet — then runs `kanban.mjs archive 4`
to take the card off the board and record the metric.

```bash
node .claude/skills/kanban/kanban.mjs archive 4
```

The card file isn't deleted — it moves to `docs/kanban/.archive/`, which stays in git. So
you can still read a finished card, or diff it, long after it left the board.

## Reject an idea

Say **"reject #4"** (rare). The skill adds a one-line "why not" to `rejected.md` and runs
`kanban.mjs reject 4`. Future loops won't re-propose it.

## Keep it lean

Over time the memory set — `readme.md`, `decisions.md`, `rejected.md`, and
`redesign.md` — grows. Ask the skill to **prune** it — it compresses each to
planning-useful summaries grouped by topic, so scans stay cheap. The board itself stays
small because finished work is a note, not a card.

## The commands, for reference

Only `kanban.mjs` allocates ids or touches metrics — never edit `next-id` or `metrics.csv`
by hand.

```bash
node .claude/skills/kanban/kanban.mjs create [--count N]   # allocate ids
node .claude/skills/kanban/kanban.mjs release new v1       # plan a version
node .claude/skills/kanban/kanban.mjs release new v1 --fill # …with the high-priority cards in
node .claude/skills/kanban/kanban.mjs release list         # what each version holds
node .claude/skills/kanban/kanban.mjs release close v1     # the version shipped
node .claude/skills/kanban/kanban.mjs release drop v1      # the version will not ship
node .claude/skills/kanban/kanban.mjs archive <id>         # finish a task
node .claude/skills/kanban/kanban.mjs reject  <id>         # drop an idea
node .claude/skills/kanban/kanban.mjs peek                 # next free id
node .claude/skills/kanban/kanban.mjs metrics              # the daily CSV
node .claude/skills/kanban/kanban.mjs help                 # full usage
```
