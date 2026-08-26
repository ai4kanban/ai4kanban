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

Deliver #319's proven task events to Slack and return authenticated decisions through the same
Worker action path. Pressing **Implement** in a Slack message is the decision itself: Cloud
records it the moment it is pressed, and the board's server runs it when that machine is
reachable.

## Worth noting
- **A Slack button decides, it does not open the app**: pressing it records the durable
  decision in Cloud from wherever the message is read, so the release's point — settling a
  task without the machine in front of you — holds from a phone. It beat opening the installed
  app on that card, which would have left Slack a message with nothing to press until #322
  puts a board in the browser. The cost is a second authenticated action path to sign,
  deduplicate, and keep refusing stale revisions.
- **Slack uses an interactive app**: signed callbacks and actor linking provide the actions
  this flow needs, at the cost of connector credentials and connection setup.
- **The message says when nothing will pick the decision up**: a board whose server is off, or
  has none attached, leaves the decision at `waiting for server`, and the message names the
  machine it is waiting for. The cost is one more thing to render; without it a decision made
  from a phone reads as ignored.

<!-- agent -->

## Scope
- Let the authenticated user connect and disconnect one Slack destination for the account, and
  name the board on every message so several enabled boards stay apart.
- Associate the Slack actor with the Supabase-authenticated AI4Kanban account from #326 before
  accepting a task action.
- Render the same ready-review and user-question events proven by the desktop notification
  center, with enough task context to make the decision deliberate.
- Offer **Implement** for the exact ready revision and the relevant answer controls for
  user-owned questions.
- Record a pressed action in Cloud on the spot, through #319's connector-neutral action path,
  without opening the app and without changing task state inside the connector.
- Verify Slack's signature on every callback and refuse one that is unsigned, wrongly signed,
  or old enough to be a replay.
- Render outcomes under the same nine state names #319 fixed — actionable, accepted, waiting
  for server, running, completed, failed, stale, cancelled, interrupted — read from the same
  durable state as the desktop notification center, and refuse an unlinked or unauthorized
  actor with its own message.
- Name the server a decision is waiting for while it reads `waiting for server`, and say so
  when the board has none attached.
- Retry Slack delivery under the event's stable action and execution IDs.
- Carry a link that opens the named card in the app, on the URL scheme #326 registers; it is
  for reading the whole card, never for making the decision.
- Keep Slack credentials and connection setup outside the event content model.

## Todo
- [ ] Add Slack connection, identity linking, destination settings, and disconnect controls.
- [ ] Render the existing Cloud event messages and their allowed actions in Slack.
- [ ] Record **Implement** and question answers in Cloud from the Slack callback, through the
      authenticated action path.
- [ ] Verify Slack's callback signature and timestamp, and refuse a replayed callback.
- [ ] Refuse unlinked, unauthorized, duplicate, and stale Slack actions clearly.
- [ ] Keep the original Slack message synchronized with the decision and delivery outcome,
      under #319's state names.
- [ ] Name the server a decision waits for, and say so when the board has none attached.
- [ ] Retry failed delivery under the original event and action IDs.
- [ ] Add the route that opens a named card in the app, on the URL scheme #326 registers.
- [ ] Check that a decision pressed in Slack with the app closed runs when the board's server
      comes back.
- [ ] Check that Slack preserves the existing event eligibility, message meaning, and
      execution rules.

## Decided by the agent
- **Where a Slack decision is recorded**: in Cloud, by the Worker handling the callback — the
  same durable row a desktop decision writes. The connector never touches the local card, so a
  Slack answer and a desktop answer stay one act with one history.
- **How many Slack destinations an account has**: one, shared by every board the user turns
  Cloud on for, with the board named on each message. A destination per board is a second
  setting to explain in a preview whose whole audience is one person.
- **What the answer controls look like**: whatever shape #319 settles for answering a
  user-owned question, in Slack's own control — buttons for listed options, and a modal if free
  text ships. This card renders that contract rather than widening it.

### Overruled by the user
- **How Slack reaches a card**: a URL scheme the desktop app registers and answers by opening
  that card. Nothing registers one today, so this card adds it. It now carries a reader to the
  whole card; it is no longer how a decision is made.
