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

## Feedback a user sends

- **Where does user feedback go?**: the telemetry service takes it, stored apart from the
  anonymous usage counts, with the privacy page saying how the two differ. What a user
  writes and authorizes is separate from "Numbers only", which still governs the board's
  own automatic report.
- **Does feedback carry the machine's install id?**: yes, the same id the anonymous usage
  counts use, so one machine's several pieces of feedback link up and match the failures it
  already reported. A machine with usage reporting off holds no such id and its feedback
  goes without one — nothing mints an identifier for feedback alone. "Numbers only" still
  governs the automatic report, but the privacy page can no longer claim usage reporting
  shares an identifier with nothing a user wrote.
- **How long is feedback kept?**: the body indefinitely, the diagnostic attachments deleted
  after 90 days on the raw events' existing clock. The privacy page states both periods.
- **Where does a request to delete what a user sent go?**: to the existing
  `support@ai4kanban.dev`, not a mailbox opened for one feature. Every screen and page that
  offers the deletion names that address, and the id shown when the submission succeeded is
  what the request quotes.
