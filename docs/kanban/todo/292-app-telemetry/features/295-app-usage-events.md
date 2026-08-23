---
title: Report app opens and which parts of the board get used
track: 292-app-telemetry/features
priority: med
roi: high
status: todo
release: 0.7.2
blocked_by: [293, 294]
related: [292]
modules: [local-ui, skill]
schedule:
  action: implement
questions: []
---

Downloads say how many people took the app; nothing says how many opened it or came back.
Report app opens and the handful of actions that say the product is being used.

## Worth noting
- The counts only ever cover installs that were asked in the app, because #293 decided the
  command never prompts. Someone who installs `akb` from npm and never opens the app is
  absent from every number here, so terminal use is undercounted, not measured.
- Cards created, archived and rejected are not sent from here, so nothing in this card
  says how much planning a board did. That number comes from #296 instead, and it arrives
  once a day rather than as it happens.

<!-- agent -->

## Today
- The app reports nothing. An install opened once and one used daily look the same to us.
- We cannot tell which version people are on, so we cannot tell whether an update reached
  anybody.
- The board already writes card-created, card-archived, card-rejected and question-closed
  into `docs/kanban/record.csv` as each move runs, so those facts do not need an event of
  their own.

## Scope
- Send one event when the app is opened, carrying the app version, the operating system,
  and whether this is the first open on this install.
- Send one event a day at most saying the app was used that day, so returning use can be
  counted without sending an event per click.
- Count the actions that only a running app or command knows about, and that the board
  writes down nowhere: a run started, a run finished, a run failed, and a chat message
  sent.
- Send nothing here for a card created, archived or rejected, or for a question closed.
  `record.csv` already holds those and #296 sends their counts.
- Each counted action carries its name and nothing about the card it happened on.
- Each event says which surface it came from — the app or the command — so app use and
  terminal use can be told apart rather than summed.
- Send the harness the run used, by name only.
- Send nothing at all unless #293's setting says yes.
- Events are queued on disk and sent in batches, so an offline machine loses nothing and a
  slow network never makes the app wait.
- At most one batch a day is sent, at a time of day the install picks for itself, so a
  release day does not arrive at #294's endpoint all at once.
- The queue and its sender are the group's only one; #296 sends through them rather than
  building a second.
- A queue that cannot be sent is capped and the oldest entries are dropped; it never grows
  without limit.
- Sending failures are silent to the user and never appear as an error in the app.
- The `akb` command reports the same actions when the board is driven from a terminal
  instead of the app.
- Out of scope: how long anything took, what anything cost, and anything typed by the user.

## Todo
- [ ] add the on-disk queue with a cap and batched sending, usable by `akb` as well as the app
- [ ] send at most one batch a day, at a time of day the install picks for itself
- [ ] send the open event with version, operating system and first-open
- [ ] send the once-a-day used event
- [ ] count runs started, finished and failed, and chat messages sent, each marked with its surface
- [ ] send the harness name with a run event
- [ ] check nothing is sent when the setting is off
- [ ] check the app is unaffected offline and when the endpoint is down
- [ ] add the new events to the privacy page from #293

## Decided by the agent
- **Why a daily event and not one per click** — returning use is the number that matters,
  and one event a day answers it. An event per click is far more data for a question
  nobody asked.
- **Why runs and chat but not cards created** — a run and a chat message happen inside the
  app or the command and are written down nowhere else. A card created is already a line in
  `record.csv`, so sending it here too would give two counts of one fact that drift apart
  the moment a send is dropped or a file is hand-edited.
- **Why the action name and no card id** — an id is meaningless to us and identifying to
  the user's project.
- **Why `akb` reports too** — a user who works from a terminal is still a user, and
  leaving them out would make the app look more used than it is.
- **Why the surface is on every event** — the app and the command send the same action
  names. Without it, "how many people opened the app" cannot be separated from work done
  in a terminal, which is one of the four questions this group exists to answer.
- **Why the queue is built here and reused** — this card is the first sender, and two
  queues would mean two retry rules, two caps, and two chances to send from a machine that
  said no.
