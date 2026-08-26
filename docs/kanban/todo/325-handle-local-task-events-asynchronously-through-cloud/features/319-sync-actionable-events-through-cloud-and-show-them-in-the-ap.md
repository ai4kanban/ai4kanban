---
title: Sync actionable events through Cloud and show them in the app
track: features
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [326]
related: [325]
modules: [cloud, local-ui]
questions: []
---

Turn local task states that need judgment into durable Cloud events and show them in the
desktop app. Today the user must keep watching the board, and Slack cannot be built or tested
against a stable event and action contract.

## Worth noting
- **The notification center is the first destination**: the desktop app proves real messages,
  decisions, stale-state handling, and outcomes before #320 adds an external dependency.
- **Cloud holds a review snapshot, not the board**: enough task context goes to Cloud for a
  deliberate decision, while the local Markdown board stays authoritative.

<!-- agent -->

## Scope
- Keep notifications off until the user enables them and chooses one open release.
- Create events only when a task enters `ready` or has user-owned questions.
- Create events from authoritative local changes regardless of whether the app, CLI, or an
  agent caused them.
- Give each event the authenticated user, task number, release, human-readable context,
  current revision, requested decision, and allowed actions.
- Preserve question choices and recommendations without exposing internal ownership tags.
- Store the event, its connector deliveries, human action, and outcome separately so any
  stage can retry without duplicating another.
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
- [ ] Publish qualifying local state changes to the authenticated user's Cloud event stream.
- [ ] Record connector delivery, human action, and outcome independently.
- [ ] Add the desktop notification center, unread state, history, and empty states.
- [ ] Approve implementation and answer user-owned questions from the desktop message.
- [ ] Refuse stale and duplicate actions without changing the local task.
- [ ] Reflect meaningful action and execution outcomes in the existing notification.
- [ ] Check the complete message and action flow without Slack connected.

## Decided by the agent
### Overruled by the user
- **A question goes to the owners**: no card names a person in this release (#311), so a
  user-owned question is addressed to the workspace's owner role and a ready-for-review card
  to everyone watching the release. Routing a question to a named member waits for the
  version that gives a card an assignee.
