---
title: Rewrite raw material into a short brief before any card is written
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [250, 157]
modules: [skill]
questions:
  - question: "[user] What happens to the brief before the cards are written? A run started from the app has nobody to answer it — there is no live reply channel."
    mode: single
    options:
      - "the same rule as a spec import (#157): in a coding-agent session the agent shows the brief and waits for a yes; a run started from the app writes the brief into its log and carries on"
      - the brief always goes into the log and the run carries on — one rule everywhere, and a wrong card is revised after
      - the run stops once the brief is written and leaves it for the user to approve; a second run writes the cards
    recommend: [1]
---

A run is handed whatever the user typed, word for word, inside its prompt. That works for
one clear sentence. Paste in a three-page document or a two-minute voice transcript and the
run plans cards from loose notes: it reads a passing aside as a requirement, and it fills in
the parts nobody said. Put one step in front of the card writing — turn the material into a
short brief first, and plan from the brief.

## Scope
- One step in front of the card writing, for a task idea the user gave in their own words —
  typed, in a file (#252), or spoken (#253).
- An article, a complaint or a write-up skips it. `akb guide extract-ideas` reads a source
  as it does today.
- A plan the user already wrote skips it. `akb guide plan-from-spec` (#157) reads a spec
  whole.
- `akb guide add-task` says which of the three readings a request gets.
- What goes in is the material, word for word.
- What comes out is a short brief with a fixed shape: what is wanted, why it matters, what
  is explicitly out, and what the material never says.
- The brief carries only what the material says.
- Anything the material never says is listed as unknown, never filled in.
- Every line of the brief can be traced back to the material it came from.
- Long material is read whole. Nothing is dropped for being far down the file.
- Short, already clear text passes straight through: a one-line idea comes out as a one-line
  brief.
- The card-writing flow reads the brief.
- The material itself never travels inside the words a run is started with.
- What the material leaves open becomes an open question on the card it belongs to.
- Where the material holds several unrelated requests, the brief says so.
- The board's own create uses it — the Create task button, and `akb create` from a terminal
  — for anything past a couple of sentences.
- The brief is kept in the run's own folder beside its log, and goes when that log goes.

## Todo
- [ ] Fix the brief's shape: wanted, why, out of scope, unknown.
- [ ] Write the rewriting step as its own flow, with the rules that hold it to what was
      said.
- [ ] Say the size at which it kicks in, so a one-line idea skips it.
- [ ] Carry what the material leaves open into the new cards as open questions.
- [ ] Split several unrelated requests in one piece of material into separate briefs.
- [ ] Write the routing rule into `akb guide add-task`: a task idea gets the brief, a source
      goes to extract-ideas, a written plan goes to #157.
- [ ] Show the brief before the cards are written.
- [ ] Keep the brief in the run's own folder beside its log.
- [ ] Say in the daily-loop guide that a typed or spoken idea now goes through a brief, and
      that a source and a written plan do not.
- [ ] Run it on a long document and read the cards it produced.
- [ ] Run it on a rambling transcript and read the cards it produced.

## Decided by the agent
- **Who writes the brief**: the coding agent the board already runs, as the first step of
  the same run. No second model and no API key.
- **Where the brief is kept**: beside the run's log, not on the board. It is evidence of one
  run, not a card.
- **Why a fixed shape**: "unknown" has to be a place the brief must fill in, or the run
  quietly answers it instead of admitting it.
- **Why a source and a written plan skip it**: extract-ideas reads a source as evidence and
  quotes its own words back into each card's `## Source`; #157 promises every part of a spec
  becomes work. A short reading in front of either thins what it has to judge.
