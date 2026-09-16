# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Board writes

- ❌ **Call a network-backed board write "asynchronous"** → ✅ a write commits to the
  authoritative board before its call returns; only reads may come from a cached snapshot.
  Queueing a write locally and reconciling later is how two people's edits diverge.

## Published promises

- ❌ **Write a public privacy or terms page for the release that will eventually ship the
  feature** → ✅ the pages describe what the nearest release actually gives a user, and the
  card that changes what we do with their data rewrites the page in the same delivery.
- ❌ **Leave the correction of a published page to a later release** → ✅ the correction
  belongs to a card in the release that invites people, because a promise nobody can act on
  is still published.

## Event handling

- ❌ **Require a shared Cloud board before one person can act on a notification remotely** →
  ✅ keep the board authoritative on the local machine and use authenticated Cloud only to
  relay revisioned snapshots, decisions, execution requests and outcomes.
- ❌ **Let a connector button change a task without identifying its user or approved
  revision** → ✅ authenticate the actor, bind the action to the reviewed revision, then let
  the local server recheck both before changing the board.
- ❌ **Treat a live subscription as the delivery** → ✅ a broadcast is a hint; every start and
  reconnect reads pending rows durably first, or an event raised while a client was closed
  reaches nobody.
- ❌ **Rely on an outbox to cover a lost write** → ✅ an outbox only retries publications that
  were written; a scan at start for actionable state with no publication on record covers the
  gap between the two writes.
- ❌ **Hold a claim without an expiry** → ✅ a claim runs on a lease the worker renews, so a
  killed process releases the work instead of leaving the user watching `running` forever.
- ❌ **Let each destination name an outcome its own way** → ✅ fix the state names once where
  they are stored; every destination renders the same durable row.
- ❌ **Read a channel's whole message stream to catch a message meant for the app** → ✅ a
  mention is one subscription that arrives only when the app is addressed; read in full only
  its own direct message.
- ❌ **Let a connector chat only about the card its message carries** → ✅ the board's own
  conversation is a chat too, and only a card's thread scopes a turn to a card.
- ❌ **Block a solo Cloud board's browser decisions on the team's notification-routing card**
  → ✅ the event moves onto the workspace where the browser needs it, and the team card keeps
  the audience, the per-member fan-out and the routing.
- ❌ **Explain a relay by listing unused transports and services** → ✅ name each component's
  runtime and trace the chosen path through it.
