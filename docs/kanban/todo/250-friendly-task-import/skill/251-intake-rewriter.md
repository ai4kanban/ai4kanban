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
  - question: "[user] Does the user see the brief before the cards are written?"
    mode: single
    options:
      - yes, the run shows the brief and waits — the user fixes a wrong reading before 10 cards are built on it
      - no, the brief is written and used in one go — faster, and a wrong card can be revised after
    recommend: [1]
---

A run is handed whatever the user typed, word for word, inside its prompt. That works for
one clear sentence. Paste in a three-page document or a two-minute voice transcript and the
run plans cards from raw material: it reads a passing aside as a requirement, and it fills
in the parts nobody said. Put one step in front of the card writing — turn the material
into a short brief first, and plan from the brief.

## Scope
- One step, shared by every way work arrives: typed text, a file (#252), spoken words
  (#253).
- What goes in is the raw material. What comes out is a short brief with a fixed shape:
  what is wanted, why it matters, what is explicitly out, and what the material does not
  say.
- The brief carries only what the material says. Anything missing is listed as unknown —
  never filled in.
- Every line of the brief can be traced back to the material it came from.
- Long material is read whole and cut down. Nothing is dropped for being far down the file.
- Short, already clear text passes straight through. A one-line idea must not come out as a
  paragraph of ceremony.
- The brief is what the card-writing flow reads. Raw material is never pasted into the
  create prompt.
- What the material leaves open becomes an open question on the card it belongs to.
- Where the material holds several unrelated requests, the brief says so, so they become
  separate cards instead of one crowded one.
- The board's own flows use it: `akb create` for anything past a couple of sentences, and
  the spec-file flow (#157) for a file too big to read in one prompt.
- The brief is kept with the run, so what the cards were planned from can be read back
  later.

## Todo
- [ ] Fix the brief's shape: wanted, why, out of scope, unknown.
- [ ] Write the rewriting step as its own flow, with the rules that hold it to what was
      said.
- [ ] Say the size at which it kicks in, so a one-line idea skips it.
- [ ] Carry what the material leaves open into the new cards as open questions.
- [ ] Split several unrelated requests in one piece of material into separate briefs.
- [ ] Point `akb guide add-task` at the step, and say when material must go through it.
- [ ] Show the brief to the user for a fix before the cards are written — see the open
      question.
- [ ] Keep the brief with the run's log.
- [ ] Check it on a real case: a long document and a rambling transcript, and read the cards
      each one produced.

## Decided by the agent
- **Who writes the brief**: the coding agent the board already runs, as the first step of
  the same run. No second model and no API key.
- **Where the brief is kept**: beside the run's log, not on the board. It is evidence of one
  run, not a card.
- **Why a fixed shape**: "unknown" has to be a place the brief must fill in, or the run
  quietly answers it instead of admitting it.
