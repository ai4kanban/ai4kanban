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
