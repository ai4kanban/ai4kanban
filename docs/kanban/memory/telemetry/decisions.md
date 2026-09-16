# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## The service that takes the events

- **Which plan does it run on?**: the Cloudflare Workers free plan. A day past its allowances
  loses events rather than producing a bill; we move to Workers Paid when the numbers force it.

## What a board reports about itself

- **How much of a board's own record may leave a machine?**: counts only — never a card id, a
  title or a release name. The privacy page publishes "Numbers only", so sending anything else
  means rewriting a published policy and deploying the service ahead of the sender.

## Feedback a user sends

- **Where does it go?**: the telemetry service, stored apart from the anonymous usage counts,
  with the privacy page saying how the two differ.
- **Does it carry the install id?**: yes, the same id, so one machine's several pieces of
  feedback link up and match the failures it already reported. A machine with usage reporting
  off has no such id and its feedback goes without one — nothing mints an identifier for
  feedback alone.
- **How long is it kept?**: the body indefinitely, the diagnostic attachments deleted after 90
  days on the raw events' clock. The privacy page states both periods.
- **Where does a deletion request go?**: to the existing `support@ai4kanban.dev`, named on
  every screen and page that offers the deletion, quoting the id shown when the submission
  succeeded.

## Reading the numbers

- **Where does the team read them?**: on a page served by a local server started on the reader's
  own machine, from its own `.env`, against the same daily summaries. It is never hosted and has
  no sign-in — being on that machine is the whole of the access control.
- **Does any number leave the service?**: one does. A public read-only route answers the
  cumulative install count and nothing else, so the README can carry an install badge; every
  other number is still read only from a machine holding the Cloudflare account.

## Getting a fix live

- **When does a fix to the nightly summaries ship?**: the day it is built, by hand on a machine
  holding the Cloudflare account, rather than riding the next regular release — the summaries
  only backfill nine days, so a wait costs install counts nobody can recover.
