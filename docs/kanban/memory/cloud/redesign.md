# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Board writes

- ❌ **Call a network-backed board write "asynchronous"** → ✅ a write commits to the
  authoritative board before its call returns; only reads may come from a cached snapshot.
  Returning a promise is plumbing, not permission to queue, buffer, or apply a write
  locally and reconcile later — that is precisely how two people's edits diverge.
