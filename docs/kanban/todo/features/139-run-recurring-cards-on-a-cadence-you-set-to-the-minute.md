---
title: Run recurring cards on a cadence you set to the minute
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

Let a recurring card say how often it repeats — every 30 minutes, every 6 hours, every
day at 09:30 — and let the server run it on that cadence in the background, so a job
that repeats actually repeats without anyone clicking.

A recurring card already has a Run button. That still needs a human every time. A cadence
is what turns a repeating job into one that runs itself, and it has to fit real jobs:
a health check wants minutes, a report wants a fixed hour of the day.

## Scope
- A recurring card can carry a `cadence` in its frontmatter. It is one line, written in
  plain units:
  - `30m`, `90m` — every N minutes.
  - `2h`, `6h` — every N hours.
  - `1d`, `7d` — every N days.
  - `1d at 09:30`, `7d at 09:30` — every N days, at that time of day. The `at HH:MM`
    part is allowed only when the interval is whole days.
  A card with no cadence runs only when the user clicks Run. Writing a cadence is the
  opt-in to background runs.
- The script writes the field: a new `--cadence` flag on `kanban create`/`update`. Only a
  card under `todo/recurring/` accepts it. A cadence the grammar above doesn't cover is
  refused with a message showing the accepted forms — never written half-parsed.
- The UI writes it too. A recurring card's page has a cadence control: pick a number and
  a unit, and for days add a time of day. "No cadence" is one of the choices and clears
  the field, so the card goes back to manual.
- The card page shows the last run and, when there is a cadence, the next due time beside
  it. Both are the server's local time.
- Due means: a card that never ran is due now; otherwise the interval since `last_run`
  has passed. With `at HH:MM`, the day the interval lands on must also have reached that
  time.
- The server's dispatcher — the same minute timer that drives auto-refine — also runs due
  recurring cards. On a tick it finds the recurring cards whose cadence has elapsed and
  starts the same headless Run the button would: highest priority first, one at a time.
  The run lands in the registry like any other, so the runs panel shows it and Stop works.
- Recurring runs have their own single slot, separate from the auto-refine slots. A refine
  going must not hold back a job that is due, and a job still running must not start a
  second copy of itself.
- The auto-refine switch does not gate these runs — it stays about refining. The cadence
  on the card is the only switch background runs have.
- A card whose newest run was stopped **or** failed is not picked again until a manual
  Run. `last_run` is only stamped mid-flow, so without this a broken agent connector
  would make the card look due again on every tick.
- A cadence shorter than the dispatcher's tick still runs once per tick — the tick is the
  floor. Say so where the cadence is documented.

## Todo
- [ ] Parse and format a cadence: `<N>m`, `<N>h`, `<N>d`, and `<N>d at HH:MM`. One
      parser, shared by the script and the server.
- [ ] Add `--cadence` to `kanban create`/`update`, refusing it on a non-recurring card
      and refusing a form the grammar doesn't cover.
- [ ] Keep `cadence` through both frontmatter serializers (script and UI).
- [ ] Compute "due": no `last_run` is due now; otherwise the interval since `last_run`
      has passed, and for `at HH:MM` that time of day has also been reached.
- [ ] Extend the dispatcher tick: start a headless Run on the highest-priority due
      recurring card — its own slot, one at a time, skipping locked cards and cards whose
      newest run was stopped or failed.
- [ ] Add the cadence control to the recurring card page, including the "No cadence"
      choice.
- [ ] Show the next due time beside the last-run time on cards that have a cadence.
- [ ] Add the `cadence` field and its forms to `references/recurring-task.md`'s
      card-shape section.
- [ ] Update `kanban-ui/README.md`: the cadence control and background runs.
- [ ] Create a recurring card, set a short cadence, and watch a run start on its own and
      show up in the runs panel.

## Decided by the agent
- Why an interval and not three named options? — Real jobs don't fall into three buckets.
  A number plus a unit covers every one of them, reads plainly, and `1d at 09:30` still
  says "daily" to anyone reading the card.
- Why not a cron expression? — This board is written in plain language a non-expert reads
  in one pass. `30 9 * * *` is not that, and cron's power beyond "every N, at this time"
  is not what a recurring card needs.
- What about "the 1st of every month"? — Not supported. `30d` is the nearest form. A
  calendar month needs its own rules for short months and month ends, which is more
  machinery than a board's recurring jobs are worth.
- Which clock? — The server's local time, for both `at HH:MM` and the next-due display.
  The board is a local tool; there is no other clock to pick.
- Does a missed window pile up? — No. A card that was due while the server was off runs
  once on the next tick, not once per window it missed.
- Does a card with `1d at 09:30` wait for 09:30 the first time? — No. A card that never
  ran is due right away, and the time of day holds from the second run on. Waiting up to
  a day to see the job work once would be the wrong first impression.
- Where is the cadence set when the card is made? — Not in the Create dialog. Creating
  stays one free-text box, and the cadence is set on the card page afterwards.
