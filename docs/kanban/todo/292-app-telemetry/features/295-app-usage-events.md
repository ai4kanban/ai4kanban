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
questions: []
---

Downloads say how many people took the app; nothing says how many opened it or came back.
Report app opens and the handful of actions that say the product is being used.

## Today
- The app reports nothing. An install opened once and one used daily look the same to us.
- We cannot tell which version people are on, so we cannot tell whether an update reached
  anybody.

## Scope
- Send one event when the app is opened, carrying the app version, the operating system,
  and whether this is the first open on this install.
- Send one event a day at most saying the app was used that day, so returning use can be
  counted without sending an event per click.
- Count the actions that say the board is doing its job: a card created, a run started, a
  run finished, a run failed, a card archived, a card rejected, a question answered, a
  chat message sent.
- Each counted action carries its name and nothing about the card it happened on.
- Each event says which surface it came from — the app or the command — so app use and
  terminal use can be told apart rather than summed.
- Send the harness the run used, by name only.
- Send nothing at all unless #293's setting says yes.
- Events are queued on disk and sent in batches, so an offline machine loses nothing and a
  slow network never makes the app wait.
- A queue that cannot be sent is capped and the oldest entries are dropped; it never grows
  without limit.
- Sending failures are silent to the user and never appear as an error in the app.
- The `akb` command reports the same actions when the board is driven from a terminal
  instead of the app.
- Out of scope: how long anything took, what anything cost, and anything typed by the user.

## Todo
- [ ] add the on-disk queue with a cap and batched sending
- [ ] send the open event with version, operating system and first-open
- [ ] send the once-a-day used event
- [ ] count the listed actions from both the app and `akb`, each marked with its surface
- [ ] send the harness name with a run event
- [ ] check nothing is sent when the setting is off
- [ ] check the app is unaffected offline and when the endpoint is down
- [ ] add the new events to the privacy page from #293

## Decided by the agent
- **Why a daily event and not one per click** — returning use is the number that matters,
  and one event a day answers it. An event per click is far more data for a question
  nobody asked.
- **Why the action name and no card id** — an id is meaningless to us and identifying to
  the user's project.
- **Why `akb` reports too** — a user who works from a terminal is still a user, and
  leaving them out would make the app look more used than it is.
- **Why the surface is on every event** — the app and the command send the same action
  names. Without it, "how many people opened the app" cannot be separated from work done
  in a terminal, which is one of the four questions this group exists to answer.

### Worth noting
- The counts only ever cover installs that were asked in the app, because #293 decided the
  command never prompts. Someone who installs `akb` from npm and never opens the app is
  absent from every number here, so terminal use is undercounted, not measured.
