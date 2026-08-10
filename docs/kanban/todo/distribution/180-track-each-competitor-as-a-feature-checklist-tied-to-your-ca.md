---
title: Track each competitor as a feature checklist tied to your cards
track: distribution
priority: med
roi: med
status: ready
release: 0.6.0
blocked_by: []
related: []
modules: [site]
questions: []
---

The competitor recipe writes a prose study per competitor, so you can't see at a glance
which of their features you already ship, which one of your cards is building, and which
nobody has touched. Rewrite the recipe as a recurring task that keeps one plain feature
checklist per competitor.

## Scope
- Replace the published recipe at `web/public/recipes/competitor-analysis-loop.md` with
  the new recurring task. The recipe is the whole task — someone who pulls it gets the
  new loop.
- One file per competitor, holding only:
  - `Last read: <YYYY-MM-DD>` at the top, so a stale file is visible at a glance.
  - `## Features` — one checkbox line per feature the competitor has:
    - `- [ ] **bold title**: one liner (#taskid)` — a card on our board is building it.
    - `- [ ] **bold title**: one liner` — nobody is working on it.
    - `- [x] **bold title**: one liner` — we already ship the same feature.
  - `## Sources` — one line each, `- Title: <url>`: where the features were read from.
- A feature is anything the competitor offers its users — a free tool or a side product
  counts. Nothing else goes in the file: no prose on what the product does, its pricing,
  its positioning, or its content assets.
- A box is ticked only when the feature is already in the board's shipped memory or the
  user-facing docs — something a user can do today. The same job for the user counts even
  when it works differently; a planned or half-done match does not.
- Say how a feature line changes over time: a run writes the `#taskid` on a line once a
  card is filed for that feature, ticks the box when that card ships, and adds the
  features the competitor has grown since the last read.
- Keep the parts of today's recipe that still earn their place: pulling the competitor
  mentions from dist0, ruling out false positives, and the per-competitor cadence that
  decides who gets looked at this run.
- Update the recipe's page copy in `web/components/recipes/recipes-content.ts` — the
  tagline, the summary, and the `does` steps — so the site describes the new loop.
- Run the loop on our own board too, not only publish it: the site compares us with six
  competitors by hand today and nothing keeps those feature lists current.

## Todo
- [ ] Write the new recurring task and publish it as `web/public/recipes/competitor-analysis-loop.md`.
- [ ] Define the per-competitor file in the task: the read date, `## Features`, `## Sources`, and nothing else.
- [ ] Say in the task how a feature line gets its `#taskid`, and that a box is ticked only for a feature the user can already use.
- [ ] Carry over the mention pull, the false-positive filter, and the cadence.
- [ ] Update the recipe's copy on the site so it matches what the new task does.
- [ ] Add the new task to our own board as a recurring card, with a file for each competitor the site already compares against.
- [ ] Read the new recipe end to end as a stranger would, and check every step can run without asking a human anything.

## Decided by the agent
- Does a competitor file keep today's prose study? No — only the read date, the features, and the sources. A study nobody re-reads goes stale and hides the comparison.
- Do we run this loop ourselves or only publish it? Both — publish it as the recipe and pull it onto our own board as a recurring card.
- How does a run decide we already ship a feature? It is in the board's shipped memory or the user-facing docs, so a user can do it today. Anything else stays unticked.
