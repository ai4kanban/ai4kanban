# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## The service that takes the events

- **Which plan the telemetry service runs on?**: the Cloudflare Workers free plan, at no
  cost. A day that goes past its allowances loses events rather than producing a bill; we
  move to Workers Paid ($5/month) when the numbers force it.

## What a board reports about itself

- **How much of a board's own record may leave a machine?**: counts only — the tallies and
  the event counts, never a card id, a title or a release name. The privacy page publishes
  "Numbers only" for a board's counts, so sending anything else means rewriting a published
  policy and deploying the service ahead of the sender.
