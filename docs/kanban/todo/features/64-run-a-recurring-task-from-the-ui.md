---
title: Run a recurring task from the UI
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

Give recurring cards a Run button, and let the server run them on their cadence in the
background — so a job that repeats actually repeats, not only when someone clicks.

The skill supports recurring tasks — cards under `todo/recurring/` that repeat and are
never archived. The UI shows that folder as a plain column but gives its cards the
one-shot Implement button, which builds a card once — wrong for a job that repeats. And
nothing runs these cards on a schedule: today every run needs a human to start it.

## Scope
- A card under `todo/recurring/` gets a **Run** button in place of Implement. It spawns
  the agent on the card, following the skill's `references/recurring-task.md` flow —
  do the `## Process` steps, record the run with `kanban run <id>`, improve the process.
  The run is headless, so the prompt tells the agent not to ask: a `[ask]` step it can't
  answer goes unanswered into the run's open-questions file, per that flow.
- Edit, Resolve, and Reject stay as they are; Archive never shows — a recurring card has
  no end state.
- `kanban run <id>` stamps `last_run: YYYY-MM-DD` into the card's frontmatter. Both
  frontmatter serializers — the script's and the UI's — keep the field when present,
  so a later edit doesn't erase it.
- On the card page, show when the task last ran, read from `last_run`. A missing field
  means "Never run".
- A recurring card can carry a cadence in its frontmatter — `cadence: daily | weekly |
  monthly` — written only by the script, through a new `--cadence` flag on
  `kanban create`/`update`. No cadence means the card runs only when the user clicks Run.
- The server's dispatcher — the same minute timer that drives auto-refine — also runs
  recurring cards in the background. On a tick it finds recurring cards whose cadence
  has elapsed since `last_run` (never ran counts as due) and starts the same headless
  Run session the button would, highest priority first, one at a time. The run lands in
  the registry like any other, so the runs panel shows it and Stop works. Writing a
  cadence is the opt-in — the auto-refine switch stays about refining and does not gate
  these runs. A card whose newest run was stopped is not picked again until a manual Run.
- On a card with a cadence, show the next due date beside the last-run date.
- The refine side of the dispatcher skips recurring cards — their `## Process` has
  no todo boxes, so it would push them toward a `ready` state they never reach.

## Todo
- [ ] Detect a recurring card by its path under `todo/recurring/`.
- [ ] Replace Implement with Run; the run prompt points the agent at the
      recurring-task flow and sends unanswerable `[ask]` steps to the run file.
- [ ] Hide Archive on recurring cards.
- [ ] Stamp `last_run: YYYY-MM-DD` in `kanban run`; keep the field through both
      frontmatter serializers (script and UI).
- [ ] Show the last run's date on the card page, "Never run" when the field is missing.
- [ ] Skip recurring cards in the auto-refine side of the dispatcher.
- [ ] Add `--cadence daily|weekly|monthly` to `kanban create`/`update`; only a card
      under `todo/recurring/` accepts it, and both frontmatter serializers keep it.
- [ ] Compute "due" in the server: a card with a cadence is due when it has no
      `last_run`, or when the cadence period since `last_run` has passed.
- [ ] Extend the dispatcher tick: start a headless Run on the highest-priority due
      recurring card — one at a time, skipping locked cards and cards whose newest
      run was stopped.
- [ ] Show the next due date beside the last-run date on cards that have a cadence.
- [ ] Mention the `last_run` stamp in `references/recurring-task.md`'s record-the-run
      step, and add the optional `cadence` field to its card-shape section.
- [ ] Update `kanban-ui/README.md` with a short recurring-tasks section: the Run
      button, the cadence field, and background runs.

## Decided by the agent
- How does the server run recurring tasks in the background — the dispatcher, or Claude
  Code's builtin `/loop`? — The dispatcher. It works with any agent command the user
  configures, not only Claude Code; its runs go through the registry, so the UI can
  show, log, and stop them like every other run; and the server already owns the minute
  timer and the per-card locks. `/loop` lives inside one long Claude-only session the
  UI can't see, stop, or survive a restart with.
- How does a card opt into background runs? — By carrying a `cadence` field. Writing it
  is the consent; remove it and the card is manual again. No new global switch, and the
  auto-refine switch keeps meaning refining only.
- What counts as due? — No `last_run`, or `last_run` plus the cadence period has
  passed. Day precision is enough; the next tick after that picks it up.
- Should the Run button stand out when the task is due? — No; a due card with a cadence
  is run by the dispatcher itself, and a card without one has no due date. The last-run
  and next-due dates on the card are the signal.
- What does a headless run do with an `[ask]` step? — Skip it and log it unanswered in
  the run's open-questions file; that file exists exactly to hold what needed a human.
- How is a recurring card created from the UI? — Through the existing Create dialog:
  the free-text requirement goes to the agent's add-task flow, which picks the track.
  No new UI.
- Where does the last-run date come from? — `kanban run` stamps `last_run` in the
  frontmatter. Run files can't carry it: a fully automated run writes none, and
  folding answers back changes their dates.
