# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Shipping the Cloud programs

- **Which version does team collaboration ship in?**: no release yet. Shared Cloud boards,
  membership, roles, imports, and multi-user conflict handling follow the smaller 0.8.0
  Cloud foundation. Its privacy and terms pages are the exception — 0.8.0 needs them, so
  they ship there.
- **What Cloud behavior ships in 0.8.0?**: single-user asynchronous task handling. The local
  Markdown board stays authoritative; Cloud authenticates the user and relays revisioned
  events, human actions, execution requests, and their outcomes.
- **Where is the notification flow proven?**: in the desktop notification center first, so
  messages and actions work without Slack; Slack is the first external connector afterward.

## Cloud as a choice, not a default

- **Does a new install land on Cloud?**: no. Local is the board onboarding leads with, and
  Cloud is an explicit choice beside it. This holds until pricing and the open-source
  support policy are published; leading with Cloud is a later change.
- **Who can create a Cloud workspace in v1?**: only an account we invite. Cloud ships as an
  invite-only preview so hosting cost stays bounded until pricing exists; open signup is a
  later change that ships with pricing.
- **Who may sign in to the Cloud relay?**: only an account we admit, on the same invite-only
  terms. 0.8.0 ships the notification relay in a public release, so most people who download
  it meet a refusal saying Cloud is an invite-only preview rather than the asynchronous flow
  the release leads with. Approving an invitation is a hand step we run, and the invited
  person then admits themselves with the code; there is no self-serve sign-up and no admin
  screen in this release.
- **How does a refused person ask to be let in?**: with **Request an invite** in the refusal
  itself. The request is recorded against their account and emailed to
  `support@ai4kanban.dev`, which we approve by hand; the site gets no invite page, no
  waitlist and no public thread, and no time is promised for a reply.
- **How is an invitation given out?**: as a code the invited person redeems in the app,
  admitting one account each (#327), from 0.8.0 onward. It replaces the hand-written row
  without opening sign-up — a code is still something we decide to give.
- **How does a code reach the person who asked for one?**: Cloud emails it once we approve
  their recorded request, so approving is the whole answer rather than a reply someone
  writes. The preview therefore does send one email to a user, from the site's own domain
  with `support@ai4kanban.dev` as the reply address, and the terms and privacy pages say so.

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
- **Does the service get provisioned before team collaboration is built?**: yes. The Supabase
  project, its GitHub OAuth app, and the `api.ai4kanban.dev` route are stood up first, so
  every card from #314 on is checked against a live service rather than recording its live
  checks as outstanding.
- **Which region holds a Cloud workspace's board?**: `eu-central-1`, Frankfurt. An EU team's
  board stays inside the EU, so the privacy page covers an international transfer under an
  adequacy decision rather than a bare export. Changing it means recreating the project.
- **What does signing in to Cloud look like?**: GitHub's own consent screen, asking for no
  scopes at all, and a redirect that passes through the Supabase project's address rather
  than `ai4kanban.dev`. Putting that redirect on our own name is a paid Supabase add-on the
  preview does not take. A sign-in reads a public GitHub profile and cannot reach a private
  repository.

## What we publish about a team's data

- **What does the invite-only preview tell people about their data?**: a privacy page and a
  terms page on the public site, built with the same page code the blog uses and linked from
  the Cloud choice in onboarding. They are live before the first outside team is invited,
  and they promise that an owner can delete a workspace and everything in it.
- **Which release publishes the privacy and terms pages?**: 0.8.0, the same release that
  starts emailing an invitation code. The version that sends a user mail is the one that
  carries the pages saying so, rather than treating them as a gate cleared before Cloud is
  turned on.
- **Who legally runs AI4Kanban Cloud?**: Nullreach Ltd, a private limited company registered
  in England and Wales. It is the operator on the terms page and the data controller on the
  privacy page, and the terms are governed by English and Welsh law.
- **Does deleting a workspace take effect at once, or after a grace window?**: at once. The
  confirmed operation removes the workspace and everything in it — cards, members, execution
  nodes and the audit trail — inside the one call, with no recovery window behind it, so an
  owner's export is the only copy that survives a mis-click.
- **What notice does the preview promise before a workspace is deleted?**: no fixed period —
  the terms say we may end the preview or close a workspace at any time, with reasonable
  notice to its owners where practical, given in the app or the workspace's Slack channel
  rather than by email. An export is the only copy a team is promised.
- **How long does Cloud keep a finished event's history?**: an event is kept for as long as it
  is unresolved, then deleted 30 days after it reaches a final outcome, together with its
  deliveries, action and outcome. The privacy page's Data retention section states that period.

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
- **Can a save be refused on a Local board?**: no. The conflict path is built and tested, but
  the app writes against the writer lease it takes, so a solo user never meets a refusal one
  machine's lock already makes impossible. Passing the revision a screen read — the thing that
  turns a stale edit into a conflict — starts on Cloud, where a second teammate makes it real.
