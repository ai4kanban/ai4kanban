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

Deliver #319's proven task events to Slack and return the user's decisions to Cloud. Today
Slack can receive an outbound message, but it cannot authenticate a button press or continue
the local task lifecycle.

## Worth noting
- **Slack must be interactive**: an incoming webhook can post a message but cannot provide
  the authenticated actions this flow needs, so the user connects a Slack app instead.
- **The desktop app need not be open for the click**: Cloud records the action immediately;
  the local execution node handles it when available.

<!-- agent -->

## Scope
- Let the authenticated user connect and disconnect one Slack destination.
- Associate the Slack actor with the AI4Kanban account from #326 before accepting a task action.
- Render the same ready-review and user-question events proven by the desktop notification
  center, with enough task context to make the decision deliberate.
- Offer **Implement** for the exact ready revision and the relevant answer controls for
  user-owned questions.
- Return actions to #319's connector-neutral action path instead of changing task state
  inside the connector.
- Show accepted, waiting-for-node, running, delivered, failed, stale, and unauthorized
  outcomes in the original Slack message.
- Retry Slack delivery independently without duplicating the event, action, or implementation.
- Keep Slack credentials and connection setup outside the event content model.

## Todo
- [ ] Add Slack connection, identity linking, destination settings, and disconnect controls.
- [ ] Render the existing Cloud event messages and their allowed actions in Slack.
- [ ] Return **Implement** and question answers through the authenticated Cloud action path.
- [ ] Refuse unlinked, unauthorized, duplicate, and stale Slack actions clearly.
- [ ] Keep the original Slack message synchronized with the decision and delivery outcome.
- [ ] Retry failed delivery without duplicate events or task actions.
- [ ] Check adding Slack changes no event eligibility, message meaning, or execution rules.

## Decided by the agent
### Overruled by the user
- **A Slack action opens the installed app**: Cloud has no page at a URL in this release
  (#311), so acting on a notification means the machine the app is on. The Slack message
  still carries the whole question, so it reads anywhere; answering from a phone waits for
  the browser surface in #322.
- **How Slack reaches a card**: a URL scheme the desktop app registers and answers by opening
  that card. Nothing registers one today, so this card adds it.
