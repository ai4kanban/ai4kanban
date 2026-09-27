# Redesign

Design mistakes to avoid when writing a Cloud card: the mistake, then the design we want.

## Board writes

- ❌ **Queue a write locally and reconcile later** → ✅ lock the card before writing, so two writers can never diverge.

## Published promises

- ❌ **Write the privacy or terms page for the release that will eventually ship a feature** → ✅ describe what the nearest release gives, and rewrite the page in the same delivery that changes what we do with data.
- ❌ **Leave correcting a published page to a later release** → ✅ correct it in the release that invites people.

## Event handling

- ❌ **Require a shared Cloud board before one person can act on a notification remotely** → ✅ Cloud relays revisioned snapshots, decisions and outcomes for a Local board.
- ❌ **Let a connector button change a task without identifying its user or revision** → ✅ authenticate the actor, bind the action to the reviewed revision, and have the server recheck both.
- ❌ **Treat a live subscription as the delivery** → ✅ a broadcast is a hint; every start and reconnect reads pending rows first.
- ❌ **Rely on an outbox to cover a lost write** → ✅ also scan at start for actionable state with no publication on record.
- ❌ **Hold a claim without an expiry** → ✅ claims run on a renewed lease, so a killed process releases the work.
- ❌ **Let each destination name an outcome its own way** → ✅ fix the state names once where stored; every destination renders the same row.
- ❌ **Read a channel's whole stream to catch the app's messages** → ✅ subscribe to mentions; read in full only the app's own direct messages.
- ❌ **Let a connector chat only about the card its message carries** → ✅ the board's own conversation is a chat too; only a card thread scopes to a card.
- ❌ **Block a solo board's browser decisions on the team routing card** → ✅ move the event onto the workspace now; the team card keeps audience and fan-out.
- ❌ **Explain a relay by listing unused transports** → ✅ name each component's runtime and trace the chosen path.
