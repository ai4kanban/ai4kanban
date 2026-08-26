---
title: Sync actionable events through Cloud and show them in the app
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [326]
related: [325]
modules: [cloud, local-ui, skill]
questions: []
---

Turn local task states that need judgment into durable Cloud events and show them in the
desktop app. This gives the user a stable event and action contract before #320 carries the
same flow into Slack.

## Worth noting
- **Publication belongs to every local writer**: one shared publisher module ships in the
  desktop board server and `akb`, so a change made by the app, the CLI, or an agent raises the
  same event. The cost is a library boundary; publishing from the app alone would be less to
  build and would miss every board change made in a terminal.
- **An event outlives the app being open**: the desktop reads pending events through the
  Worker at every start and reconnect, and publishes actionable tasks it finds with no
  publication on record. The cost is two catch-up paths to keep working; without them a
  restart at the wrong moment loses a `ready` task silently.

<!-- agent -->

## Scope
- Keep notifications off until the user enables them and chooses one open release.
- Register each enabled board under a Cloud ID that means nothing outside Cloud, keep the
  mapping from that ID to the board's local path on the machine alone, and name that board on
  every event.
- Create events only when a task enters `ready` or has user-owned questions.
- Run the shared local publisher after every successful desktop, CLI, or agent board write.
- Record each publication in a local outbox before sending it through the Worker, and retry
  independently of the committed board change.
- On start, publish any actionable task on the board that has no publication on record, so a
  crash between the board write and the outbox entry cannot lose an event.
- Give each event the authenticated user, board, task number, release, human-readable context,
  current revision, requested decision, and allowed actions.
- Send every event to the one signed-in account: this release has no assignee, role, or
  watcher to route by.
- Preserve question choices and recommendations without exposing internal ownership tags.
- Store the event, its connector deliveries, human action, and outcome separately so any
  stage can retry without duplicating another.
- Store durable state in Supabase Postgres through the Worker, then send the stored event or
  request ID over a private Supabase Realtime topic authorized by the user's Auth session.
- Authorize account and node topics with RLS policies on `realtime.messages`, subscribe as
  private channels, and apply refreshed JWTs to the live connection.
- On every start and reconnect, read the account's pending events through the Worker before
  listening for hints, so an event that arrived while the app was closed still appears.
- Refuse an action when its task revision or actionable state is no longer current.
- Add a desktop notification center with a bell, unread count, newest-first history, message
  context, clear empty and disabled states, and the actions the event permits.
- Let the user approve implementation or answer questions from the notification center;
  #318 consumes an accepted implementation action.
- Update a notification with its actionable, accepted, waiting for node, running, completed,
  failed, stale, cancelled, or interrupted outcome without creating progress noise; those nine
  names are the ones #318 and #320 also use.
- Delete finished event history on the schedule #325's retention question settles, and give
  the published privacy page a Data retention line saying so.
- Pause notifications when the selected release closes and ask the user to choose another.

## Todo
- [ ] Add the board record: a Cloud ID per enabled board, the local path held on the machine
      alone, and that board named on every event.
- [ ] Add the two event rules, release filter, portable message, and durable deduplication.
- [ ] Add the shared local publisher to the desktop board server and `akb`, with one local
      outbox and retry path for qualifying state changes.
- [ ] Publish at start any actionable task with no publication on record.
- [ ] Publish through the Worker under the Supabase Auth session, then broadcast stored IDs
      over private Realtime topics.
- [ ] Configure private Realtime channels and account- and node-scoped authorization policies,
      including live JWT refresh.
- [ ] Read pending events through the Worker at every start and reconnect, before listening
      for hints.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the desktop notification center, unread state, history, and empty states.
- [ ] Approve implementation and answer user-owned questions from the desktop message.
- [ ] Return stale or duplicate outcomes and preserve the local task.
- [ ] Reflect meaningful action and execution outcomes in the existing notification, under the
      nine state names this card fixes.
- [ ] Delete finished history on the schedule #325's retention question settles, and add that
      period to the published privacy page's Data retention section.
- [ ] Check the complete desktop message and action flow before adding Slack, including a
      restart with an event and an answer that both landed while the app was closed.

## Decided by the agent
- **Why the outbox retry is not enough on its own**: the board write and the outbox row are
  not one transaction, so a crash between them leaves a `ready` task nothing will ever retry.
  The scan at start is what closes that gap.
- **Why the nine state names are fixed here**: the desktop, Slack, and the execution node all
  render one durable row, so a name invented in one of them shows the user two words for one
  outcome. This card names them because it stores them first.

### Overruled by the user
- **A question goes to the owners**: no card names a person in this release (#311), so a
  user-owned question is addressed to the workspace's owner role and a ready-for-review card
  to everyone watching the release. Routing a question to a named member waits for the
  version that gives a card an assignee.
