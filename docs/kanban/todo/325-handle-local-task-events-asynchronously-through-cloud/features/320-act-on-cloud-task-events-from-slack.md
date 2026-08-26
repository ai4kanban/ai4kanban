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
questions:
  - question: "[user] What does pressing **Implement** in a Slack message do?"
    mode: single
    options:
      - Records the decision in Cloud on the spot, exactly as the desktop inbox does — the point of this card is deciding without the machine in front of you, and it works from a phone.
      - Opens the installed desktop app on that card, and the decision is made there — what this card's Overruled by the user note says today, but it leaves Slack a message with nothing to press and waits for #322 before a phone can answer.
    recommend: [1]
---

Deliver #319's proven task events to Slack and return authenticated decisions through the
same Worker action path. Cloud records durable state immediately, and the local node catches
up with the request when it is available.

## Worth noting
- **Slack uses an interactive app**: signed callbacks and actor linking provide the actions
  this flow needs, at the cost of connector credentials and connection setup.

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
- Verify Slack's signature on every callback and refuse one that is unsigned, wrongly signed,
  or old enough to be a replay.
- Render outcomes under the same nine state names #319 fixed — actionable, accepted, waiting
  for node, running, completed, failed, stale, cancelled, interrupted — read from the same
  durable state as the desktop notification center, and refuse an unlinked or unauthorized
  actor with its own message.
- Retry Slack delivery under the event's stable action and execution IDs.
- Reuse the URL scheme #326 registers to bring a sign-in back to the app; this card adds only
  the route that opens a named card.
- Keep Slack credentials and connection setup outside the event content model.

## Todo
- [ ] Add Slack connection, identity linking, destination settings, and disconnect controls.
- [ ] Render the existing Cloud event messages and their allowed actions in Slack.
- [ ] Return **Implement** and question answers through the authenticated Cloud action path.
- [ ] Verify Slack's callback signature and timestamp, and refuse a replayed callback.
- [ ] Refuse unlinked, unauthorized, duplicate, and stale Slack actions clearly.
- [ ] Keep the original Slack message synchronized with the decision and delivery outcome,
      under #319's state names.
- [ ] Retry failed delivery under the original event and action IDs.
- [ ] Add the route that opens a named card in the app, on the URL scheme #326 registers.
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
