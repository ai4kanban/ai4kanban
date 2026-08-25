# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Shipping the team-collaboration program

- **Which version does team collaboration ship in?**: 0.8.0, alongside auto-delivery, not a
  release of its own. 0.8.0 is a much longer version as a result.

## Cloud as a choice, not a default

- **Does a new install land on Cloud?**: no. Local is the board onboarding leads with, and
  Cloud is an explicit choice beside it. This holds until pricing and the open-source
  support policy are published; leading with Cloud is a later change.
- **Who can create a Cloud workspace in v1?**: only an account we invite. Cloud ships as an
  invite-only preview so hosting cost stays bounded until pricing exists; open signup is a
  later change that ships with pricing.

## Where Cloud runs

- **Which platform hosts Cloud?**: Cloudflare Workers for compute and Supabase Postgres for
  the shared board. Compute sits on the Cloudflare account the site already deploys from;
  the board gets a Supabase project of its own.
- **Which plans does the invite-only preview run on?**: the free tier of both — Supabase Free
  and the Workers free plan, $0 a month. The preview keeps no backups, and a free-tier limit
  refuses writes rather than producing a bill; moving to paid plans is a later change that
  comes with pricing.
- **What can a team recover if a workspace is lost?**: only what they exported. The preview
  keeps no backups of its own, so the terms page says so before anyone is invited.

## What we publish about a team's data

- **What does the invite-only preview tell people about their data?**: a privacy page and a
  terms page on the public site, built with the same page code the blog uses and linked from
  the Cloud choice in onboarding. They are live before the first outside team is invited,
  and they promise that an owner can delete a workspace and everything in it.

