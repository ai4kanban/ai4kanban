---
title: Act on Cloud task events from Slack
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [318]
related: [325]
modules: [cloud, local-ui]
questions: []
---

Deliver #319's proven task events to Slack and return authenticated decisions through the
same Worker action path. Cloud records durable state immediately, and the local node catches
up with the request when it is available.

## Worth noting
- **Slack uses an interactive app**: signed callbacks and actor linking provide the actions
  this flow needs, at the cost of connector credentials and connection setup.
- **The click lands before the node runs**: Cloud records the action immediately, and the
  desktop board server or `akb` handles it through durable catch-up when available.

<!-- agent -->

## Scope
- Let the authenticated user connect and disconnect one Slack destination.
- Associate the Slack actor with the Supabase-authenticated AI4Kanban account from #326
  before accepting a task action.
- Render the same ready-review and user-question events proven by the desktop notification
  center, with enough task context to make the decision deliberate.
- Offer **Implement** for the exact ready revision and the relevant answer controls for
  user-owned questions.
- Return actions to #319's connector-neutral action path instead of changing task state
  inside the connector.
- Render accepted, waiting-for-node, running, delivered, failed, stale, and unauthorized
  outcomes from the same durable state as the desktop notification center.
- Retry Slack delivery under the event's stable action and execution IDs.
- Keep Slack credentials and connection setup outside the event content model.

## Todo
- [ ] Add Slack connection, identity linking, destination settings, and disconnect controls.
- [ ] Render the existing Cloud event messages and their allowed actions in Slack.
- [ ] Return **Implement** and question answers through the authenticated Cloud action path.
- [ ] Refuse unlinked, unauthorized, duplicate, and stale Slack actions clearly.
- [ ] Keep the original Slack message synchronized with the decision and delivery outcome.
- [ ] Retry failed delivery under the original event and action IDs.
- [ ] Check that Slack preserves the existing event eligibility, message meaning, and
      execution rules.

## Decided by the agent
### Overruled by the user
- **A Slack action opens the installed app**: Cloud has no page at a URL in this release
  (#311), so acting on a notification means the machine the app is on. The Slack message
  still carries the whole question, so it reads anywhere; answering from a phone waits for
  the browser surface in #322.
- **How Slack reaches a card**: a URL scheme the desktop app registers and answers by opening
  that card. Nothing registers one today, so this card adds it.
