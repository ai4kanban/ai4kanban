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
- **What does signing in to Cloud look like?**: GitHub's own consent screen, asking for the
  `user:email` scope and nothing else, and a redirect that passes through the Supabase
  project's address rather than `ai4kanban.dev`. Putting that redirect on our own name is a
  paid Supabase add-on the preview does not take. A sign-in reads a public GitHub profile and
  the account's verified email address, and cannot reach a repository; the privacy page's
  earlier "no scopes at all" promise goes with the change, because an invitation code needs a
  verified address to reach (#327).
- **What does turning Cloud on require of `akb`?**: nothing new. The publisher sends over
  `fetch` and the live connection is written against the published Realtime protocol rather
  than `@supabase/realtime-js`, so `akb` stays "Node 18+. No dependencies." for everyone,
  Cloud users included. A runtime with no global `WebSocket` catches up through the Worker on
  the next command instead of holding a socket.

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
  notice where practical. An export is the only copy a team is promised.
- **Where does a notice about the preview reach an invited account?**: the email address
  GitHub verified for the account, sent by hand from `support@ai4kanban.dev`, for the end of
  the preview and for a material change to the privacy or terms page. The app and a connected
  Slack channel are not notice routes, and the pages no longer promise the invitation loop is
  the only mail the preview sends.
- **How long does Cloud keep a finished event's history?**: an event is kept for as long as it
  is unresolved, then deleted 30 days after it reaches a final outcome, together with its
  deliveries, action and outcome. The privacy page's Data retention section states that period.

## Who answers a question

- **May a question be answered from a notification in the user's own words?**: yes. An event
  carries the question's options and the one it recommends, and the answer is either a ticked
  option or a sentence the user types — never both, the way the board's own Resolve works. Cloud
  holds a typed answer unchanged; an answer given in the app is applied there and then, and one
  given anywhere else waits for the board's server.
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
  browser review or Resolve. Putting a workspace on the web, so a community can read a roadmap,
  is a later version's work.
- **What does pressing Implement in a Slack message do?**: it records the decision in Cloud on
  the spot, from wherever the message is read, a phone included. It does not open the app and
  it does not need the machine to be awake — the board's server picks the decision up and runs
  it when it is next reachable. Slack's link into the app is for reading the whole card, not
  for deciding.
- **How does an account connect Lark?**: by installing an AI4Kanban app listed in the
  cloud's own directory, so connecting is one button and the user registers nothing. Both
  `open.larksuite.com` and `open.feishu.cn` are listed, and a connection belongs to the
  cloud it was installed from.
- **What does a Slack message show about a task?**: enough to review it — the card's summary,
  its Worth noting, and its Worth noting after implementation, not just its title and the ask.
  Cloud therefore holds that text alongside the event, and everyone in the destination channel
  reads it.
- **Can a card be revised or talked through from Slack?**: not in 0.8.0 — the message carries
  **Implement** and the answer controls, and its card link opens the app for anything else.
  Replying in the thread to chat with the card's agent is wanted after it.
- **Where may a Slack reply start a chat?**: in any reply in a card's thread, in a channel or
  the direct message, with no mention of the app needed. A channel destination must have the
  app invited to it, and Slack then sends Cloud every message posted there, of which only a
  reply in a card's thread is kept.
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

## The machine that runs the work

- **What is the machine that runs a board's work called?**: a **server**. It replaces "node"
  everywhere a person can see it, including the `waiting for server` state every destination
  renders.
- **How many servers can a board have?**: exactly one for now — the machine that holds the
  board. A second attachment is refused rather than routed between, so a board whose server is
  off waits for that machine and no other. Routing across several servers is a later version's
  work.
- **Does an action taken on the board's own machine go through the server?**: no. The app's card
  page starts the delivery or writes the answer at once and records the Cloud action afterwards,
  so a click in front of the user never waits for a round trip. `waiting for server` is for an
  action taken somewhere else, which the board's server picks up.
- **What does Cloud tell a teammate about a board's server?**: its whole runtime binding — each
  runtime the board names, and the harness and model that machine runs it as. Names only: never a
  key, an argument string or a path.

- **How many actions may one event take?**: exactly one, from whichever surface acts first. Cloud
  refuses a second and tells every other surface showing that event, so a Slack message for an
  event already handled in the app is redrawn as answered rather than left pressable.
