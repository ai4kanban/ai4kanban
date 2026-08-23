# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## The service that takes the events

- **Which plan the telemetry service runs on?**: the Cloudflare Workers free plan, at no
  cost. A day that goes past its allowances loses events rather than producing a bill; we
  move to Workers Paid ($5/month) when the numbers force it.
