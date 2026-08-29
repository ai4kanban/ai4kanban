# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Board writes

- ❌ **Call a network-backed board write "asynchronous"** → ✅ a write commits to the
  authoritative board before its call returns; only reads may come from a cached snapshot.
  Returning a promise is plumbing, not permission to queue, buffer, or apply a write
  locally and reconcile later — that is precisely how two people's edits diverge.

## Published promises

- ❌ **Write a public privacy or terms page for the release that will eventually ship the
  feature** → ✅ the pages describe what the nearest release actually gives a user, and the
  card that changes what we do with their data rewrites the page in the same delivery. A page
  written ahead of the product is a false promise from the day the first person is invited.
- ❌ **Leave the correction of a published page to a card in a later release** → ✅ the page
  correction belongs to a card in the release that invites people, because a promise nobody
  can act on is still published.

## Event handling

- ❌ **Require a shared Cloud board before one person can act on a notification remotely** →
  ✅ keep the board authoritative on the local machine and use authenticated Cloud only to
  relay revisioned event snapshots, decisions, execution requests, and outcomes.
- ❌ **Let a connector button change a task without identifying its user or approved
  revision** → ✅ authenticate the actor, bind the action to the reviewed revision, then let
  the local server recheck both before changing the board.
- ❌ **Explain a relay by listing unused transports and services** → ✅ name each component's
  runtime and trace the chosen path through Supabase Auth, the Worker, Postgres, Realtime,
  local processes, and connectors.
- ❌ **Treat a live subscription as the delivery** → ✅ a broadcast is a hint; every start and
  reconnect reads pending rows durably first, or an event raised while a client was closed
  reaches nobody.
- ❌ **Hold a claim without an expiry** → ✅ a claim runs on a lease the worker renews, so a
  killed process releases the work instead of leaving the user watching `running` forever.
- ❌ **Rely on an outbox to cover a lost write** → ✅ an outbox only retries publications that
  were written; a scan at start for actionable state with no publication on record is what
  covers the gap between the two writes.
- ❌ **Let each destination name an outcome its own way** → ✅ fix the state names once where
  they are stored; every destination renders the same durable row.
- ❌ **Put a mail binding and a second personal record on the card everything else is blocked
  by** → ✅ the sign-in card carries admission and nothing else; the request, the code, and
  every email belong to the invitation card behind it.
- ❌ **Describe Cloud as switched on per board** → ✅ signing in on a machine is the switch:
  every board opened there registers itself and publishes, and a board chooses only how wide
  it watches — every release, or one. Check the app before a card promises a control.
- ❌ **Read a channel's whole message stream to catch a message meant for the app** → ✅ a
  mention is one subscription that arrives only when the app is addressed; require the app's
  name in a channel and read in full only its own direct message.
- ❌ **Let a connector chat only about the card its message carries** → ✅ the board's own
  conversation is a chat too — a direct message and a mention reach it, and only a card's
  thread scopes a turn to a card.
