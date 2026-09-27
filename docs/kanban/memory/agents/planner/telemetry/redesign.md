# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want.

## Counting installs

- ❌ **Counting from public GitHub/npm numbers because they are free** → ✅ real installs come from our telemetry; public counts are only the biased comparison.
- ❌ **Routing a usage number around the telemetry store to avoid waiting** → ✅ keep it in the telemetry store even if the card waits.

## Running against the real platform

- ❌ **Trusting a green local stand-in** → ✅ verify against the platform where its limits are tighter (D1 accepts far less SQL than local SQLite).
- ❌ **Leaving the migration to whoever remembers** → ✅ the deploy runs it and stops on failure.
- ❌ **A scheduled job reporting success when a step failed** → ✅ report the run as failed, while still running the other steps.
