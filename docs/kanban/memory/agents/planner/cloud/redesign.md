# Redesign

Design mistakes to avoid when writing a Cloud card: the mistake, then the design we want.

## Published promises

- ❌ **Write the privacy or terms page for the release that will eventually ship a feature** → ✅ describe what the nearest release gives, and rewrite the page in the same delivery that changes what we do with data.
- ❌ **Leave correcting a published page to a later release** → ✅ correct it in the release that invites people.

## Event handling

- ❌ **Require a shared Cloud board before one person can act on a notification remotely** → ✅ Cloud relays revisioned snapshots, decisions and outcomes for a Local board.
- ❌ **Let a connector button change a task without identifying its user or revision** → ✅ authenticate the actor, bind the action to the reviewed revision, and have the server recheck both.
- ❌ **Trust a broadcast, an outbox or an open-ended claim to deliver** → ✅ a broadcast is a hint: every start and reconnect reads pending rows and scans for actionable state never published, and claims run on a renewed lease.
- ❌ **Let a connector chat only about the card its message carries** → ✅ the board's own conversation is a chat too; only a card thread scopes to a card.
- ❌ **Explain a relay by listing unused transports** → ✅ name each component's runtime and trace the chosen path.
