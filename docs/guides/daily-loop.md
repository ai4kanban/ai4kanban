# The daily loop

Once the board exists, you drive it in plain language. Here's the rhythm.

## Pick what to work on

Ask **"what's next?"**. The skill:

1. Reads the board, your published docs (where shipped work is recorded), `readme.md`
   (the index of shipped work — one line per behavior, linking to its doc), and
   `rejected.md` so it won't repeat work.
2. Scans your planning sources for real gaps.
3. Proposes **three new tasks** from real gaps — not a pick from the existing pile.

You approve, tweak, or drop each. Approved ones become cards.

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
node .claude/skills/kanban/kanban.mjs archive <id>         # finish a task
node .claude/skills/kanban/kanban.mjs reject  <id>         # drop an idea
node .claude/skills/kanban/kanban.mjs peek                 # next free id
node .claude/skills/kanban/kanban.mjs metrics              # the daily CSV
node .claude/skills/kanban/kanban.mjs help                 # full usage
```
