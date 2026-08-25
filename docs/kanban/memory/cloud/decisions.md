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

## Who answers a question

- **How does a question reach a decider in v1?**: it notifies the workspace's owners. A card
  never names a person: a user-owned question goes to the owners watching the release, and a
  member is notified only when a card is ready for review. Any member may still open the card
  and answer; owner routing decides who is told, not who may write. Asking a named member is a
  later version's work.
- **What happens if a workspace has no owner?**: it cannot. The role change or member removal
  that would leave a workspace ownerless is refused, because owner is the address a question
  is sent to.

## How a board is reached

- **What does a Cloud team's repo hold?**: one committed pointer to the workspace and the
  machine's own ignored files — no cards, no memory, no mirrored markdown. `akb` and the app
  find the board by that pointer, so every teammate's clone opens the same workspace, and
  export is how a team gets markdown back. Anything that reads the board as files, such as
  #56's Obsidian view, works on a Local board or on an export, not on a Cloud checkout.
- **How does a team reach its Cloud board in the invite-only preview?**: from the installed
  app only. The preview ships no Cloud page at a URL — no public read-only board and no
  browser review or Resolve — and a Slack action opens the app. Putting a workspace on the
  web, so a community can read a roadmap and a member can answer from any device, is a later
  version's work.
- **Does a save finish before the command returns?**: yes, on every board. There is no write
  queue and no background flush: a Cloud save takes as long as the network does and `akb`
  waits for it. That is the price of two teammates never overwriting each other silently.
- **What happens when two people change the same card?**: the second write is refused as a
  conflict naming the version the board holds now, and the caller re-reads that card. It is
  never a silent overwrite, and it is never a message the user has to interpret.
