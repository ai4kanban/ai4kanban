# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Board writes

- ❌ **Call a network-backed board write "asynchronous"** → ✅ a write commits to the
  authoritative board before its call returns; only reads may come from a cached snapshot.
  Returning a promise is plumbing, not permission to queue, buffer, or apply a write
  locally and reconcile later — that is precisely how two people's edits diverge.

## Event handling

- ❌ **Require a shared Cloud board before one person can act on a notification remotely** →
  ✅ keep the board authoritative on the local machine and use authenticated Cloud only to
  relay revisioned event snapshots, decisions, execution requests, and outcomes.
- ❌ **Let a connector button change a task without identifying its user or approved
  revision** → ✅ authenticate the actor, bind the action to the reviewed revision, then let
  the local node recheck both before changing the board.
- ❌ **Explain a relay by listing unused transports and services** → ✅ name each component's
  runtime and trace the chosen path through Supabase Auth, the Worker, Postgres, Realtime,
  local processes, and connectors.
