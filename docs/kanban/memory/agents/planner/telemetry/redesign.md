# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want.

## Counting installs

- ❌ **Counting from public GitHub/npm numbers, or routing a usage number around the telemetry store to avoid waiting** → ✅ real numbers come from the telemetry store even if the card waits; public counts are only the biased comparison.

## Running against the real platform

- ❌ **Trusting a green local stand-in** → ✅ verify against the platform where its limits are tighter (D1 accepts far less SQL than local SQLite).
