---
title: Show a failed run on the card it was working on
track: features
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [50]
modules: [local-ui]
questions: []
---

When a run stops halfway through a card, say so on that card's page — and let the user
carry it on from there.

Today the card page shows a thin closed strip reading `✕ exited 1` and nothing else. The
work stopped part-way, half the todos may be written, half the files may be changed, and
the page reads like any other card. To carry on, the user has to leave the card, open the
runs panel, find the run, and press Resume there. The board card shows nothing at all: a
run only leaves a mark while it is live.

## Scope

**Say it on the card**
- When the newest run on a card stopped short — it failed, or it was cut off when the UI
  died — the card page says so in a line above the log, in plain words: the run did not
  finish, so the card may be part-built and whatever it wrote is sitting in the working
  tree.
- The line reads as a warning, not a nudge.
- It sits inside the run's own log window, not on the card's own notice strip: it is a
  fact about one run, and it goes when a newer run replaces it.
- The log opens by itself in that case, so the user reads why without a click.

**Let them carry on from there**
- **Resume** sits beside that run on the card page — the same button the runs panel
  already has, doing the same thing.
- Once it starts, the card page follows the new run: its log tails live in the same slot.

**Leave the rest alone**
- A run the user stopped is not a failure — no line, no Resume, exactly as today.
- A run that passed is untouched: the closed strip stays closed.

## Scope out
- No list of past runs on a card. The newest run is what a card shows; the runs panel is
  where you browse.
- No mark on the board's card grid. The card page is what this card is about.
- No sorting the failure into a kind — rate limit, can't start, everything else. The line
  says the run stopped short; why it stopped stays in the log.

## Decided by the agent
- Where does the line live — the card's own notice strip or the log window? The log
  window. The strip carries facts about the card; this is one run's outcome, and it goes
  when a newer run replaces it.
- Does a run cut off by a UI restart count? Yes. It stopped short the same way and can be
  resumed the same way — the board already treats the two together.
- What if the run is too old to resume, or the user has since switched agents? The line
  still shows; only the button is missing. The board already decides on its own when a run
  can be picked up.
- What if the run has aged out of the kept history? Then the card shows nothing, as it
  does now. Its log is gone from disk too, so there is nothing to open.

## Todo
- [ ] Say on the card page, in plain words, that its newest run stopped short and left the
      card part-built, instead of only marking the closed strip.
- [ ] Open that run's log by itself when the page loads, so the reason is on screen.
- [ ] Put Resume beside that run on the card page, and make the page follow the run it
      starts.
- [ ] Leave a stopped run and a passing run reading exactly as they do today.
- [ ] Add what a card with a failed run looks like to `kanban-ui/README.md`.
