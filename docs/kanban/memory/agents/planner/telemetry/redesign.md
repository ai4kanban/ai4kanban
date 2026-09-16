# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Counting installs and downloads

- ❌ **Planning a counting card around public numbers alone because they are free and need no
  consent** → ✅ the point of counting is real installs from our own telemetry; a public count
  from GitHub or npm is the biased comparison beside it, never the answer.
- ❌ **Routing a telemetry number around the telemetry group to avoid waiting on it** → ✅ a
  usage number belongs in the telemetry store even when that makes the card wait; splitting
  halves across two databases costs more than the delay.

## Standing the service up against the real platform

- ❌ **Taking a green local stand-in as proof the platform takes the same SQL** → ✅ verify
  against the platform itself wherever its limits are the tighter ones; D1 takes five SELECTs
  in a compound statement and the SQLite behind the tests takes 500, so the daily summaries
  were refused every night for nine days with every test passing.
- ❌ **A deploy that leaves the migration to whoever remembers** → ✅ the deploy runs the
  migration and stops if it fails, so the Worker is never live against a database missing a
  table its code reads.
- ❌ **A scheduled job that reports success when a step of it failed** → ✅ a run that lost a
  step is reported as failed, even though the other steps still run — a number nobody writes
  is otherwise only noticed when somebody goes looking for it.
