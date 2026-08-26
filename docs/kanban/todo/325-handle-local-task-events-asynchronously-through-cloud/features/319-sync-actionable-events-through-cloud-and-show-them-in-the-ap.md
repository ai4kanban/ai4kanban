---
title: Sync actionable events through Cloud and show them in the app
track: features
priority: med
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
- **The notification center is the first destination**: the desktop app proves real messages,
  decisions, stale-state handling, and outcomes before #320 adds an external dependency.
- **Cloud holds the review snapshot**: enough task context goes to Cloud for a deliberate
  decision, while the local Markdown board stays authoritative.
- **Publication belongs to every local writer**: one shared publisher module ships in the
  desktop board server and `akb`, adding a library boundary so app, CLI, and agent writes use
  the same outbox, retry, and event rules.

<!-- agent -->

## Scope
- Keep notifications off until the user enables them and chooses one open release.
- Create events only when a task enters `ready` or has user-owned questions.
- Run the shared local publisher after every successful desktop, CLI, or agent board write.
- Record each publication in a local outbox before sending it through the Worker, and retry
  independently of the committed board change.
- Give each event the authenticated user, task number, release, human-readable context,
  current revision, requested decision, and allowed actions.
- Preserve question choices and recommendations without exposing internal ownership tags.
- Store the event, its connector deliveries, human action, and outcome separately so any
  stage can retry without duplicating another.
- Store durable state in Supabase Postgres through the Worker, then send the stored event or
  request ID over a private Supabase Realtime topic authorized by the user's Auth session.
- Authorize account and node topics with RLS policies on `realtime.messages`, subscribe as
  private channels, and apply refreshed JWTs to the live connection.
- Refuse an action when its task revision or actionable state is no longer current.
- Add a desktop notification center with a bell, unread count, newest-first history, message
  context, clear empty and disabled states, and the actions the event permits.
- Let the user approve implementation or answer questions from the notification center;
  #318 consumes an accepted implementation action.
- Update a notification with its accepted, waiting, running, completed, failed, or stale
  outcome without creating progress noise.
- Pause notifications when the selected release closes and ask the user to choose another.

## Todo
- [ ] Add the two event rules, release filter, portable message, and durable deduplication.
- [ ] Add the shared local publisher to the desktop board server and `akb`, with one local
      outbox and retry path for qualifying state changes.
- [ ] Publish through the Worker under the Supabase Auth session, then broadcast stored IDs
      over private Realtime topics.
- [ ] Configure private Realtime channels and account- and node-scoped authorization policies,
      including live JWT refresh.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the desktop notification center, unread state, history, and empty states.
- [ ] Approve implementation and answer user-owned questions from the desktop message.
- [ ] Return stale or duplicate outcomes and preserve the local task.
- [ ] Reflect meaningful action and execution outcomes in the existing notification.
- [ ] Check the complete desktop message and action flow before adding Slack.

## Decided by the agent
### Overruled by the user
- **A question goes to the owners**: no card names a person in this release (#311), so a
  user-owned question is addressed to the workspace's owner role and a ready-for-review card
  to everyone watching the release. Routing a question to a named member waits for the
  version that gives a card an assignee.
