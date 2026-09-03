# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## What Cloud is, and what it is not

- Cloud relays; it does not hold the board. The local Markdown board stays authoritative,
  and Cloud authenticates the user and relays revisioned events, human actions, execution
  requests and their outcomes.
- Shared Cloud boards, membership, roles, imports and multi-user conflict handling have no
  release yet — they follow the single-user relay.
- Onboarding leads with a Local board; Cloud is an explicit choice beside it. Leading with
  Cloud is a later change that waits on pricing and the open-source support policy.
- The notification flow was proven in the desktop notification center first, so messages and
  actions work without Slack; Slack was the first external connector afterwards.

## The invite-only preview

- Only an account we admit may sign in, so most people who download a public release meet a
  refusal saying Cloud is an invite-only preview. Open signup is a later change that ships
  with pricing.
- A refused person asks with **Request an invite** in the refusal itself. The request is
  recorded against their account and emailed to `support@ai4kanban.dev`; the site gets no
  invite page, no waitlist and no public thread, and no time is promised for a reply.
- Approving that request is how an invitation is given: it admits the account there and then
  and emails the person to say so. Nothing is typed back and there is no code. A hand-written
  `cloud.admitted_accounts` row stays, for inviting somebody who never asked.
- An approval-written admission survives a GitHub rename, because it is decided on the
  sign-in it was written for. A hand-written row names a handle alone, so a rename un-admits
  it — which is the point of naming a handle.
- The preview therefore sends a user one email, from the site's own domain with
  `support@ai4kanban.dev` as the reply address, and the terms and privacy pages say so.
- Being added to a workspace is not an admission. A teammate an owner adds must already be
  admitted in their own right, so an owner's invitation makes an admitted account a member
  and nothing more; everyone else presses **Request an invite** and waits for us.

## Where Cloud runs

- Cloudflare Workers for compute, on the account the site already deploys from, and a
  Supabase Postgres project of its own.
- Supabase is on its free tier, $0 a month: the preview keeps no backups, and a free-tier
  limit refuses writes rather than producing a bill. Charging a user for AI4Kanban comes with
  pricing.
- The Worker moves to Workers Paid, $5 a month, when 0.9.0's public board pages ship —
  server-rendering a board does not fit Workers Free's bundle cap or its CPU per request.
- The region is `eu-central-1`, Frankfurt, so an EU team's data stays inside the EU and the
  privacy page covers a transfer under an adequacy decision. Changing it means recreating
  the project.
- Signing in is GitHub's own consent screen asking for `user:email` and nothing else,
  redirecting through the Supabase project's address rather than `ai4kanban.dev` — putting
  that redirect on our own name is a paid add-on the preview does not take.
- Turning Cloud on requires nothing new of `akb`: the publisher sends over `fetch` and the
  live connection is written against the published Realtime protocol, so `akb` stays "Node
  18+. No dependencies." A runtime with no global `WebSocket` catches up through the Worker
  on the next command instead of holding a socket.
- The service was provisioned before the features that use it, so every card since is checked
  against a live service.

## What we publish about a user's data

- A privacy page and a terms page ship on the public site, built with the same page code the
  blog uses, live before the first outside person is invited. The version that starts mailing
  a user is the one that carries the pages saying so.
- Nullreach Ltd, registered in England and Wales, is the operator on the terms page and the
  data controller on the privacy page, and the terms are governed by English and Welsh law.
- Deleting takes effect at once, with no recovery window behind it, so an export is the only
  copy that survives a mis-click.
- No fixed notice period is promised: we may end the preview or close an account at any time,
  with reasonable notice where practical.
- Notice about the preview reaches an account at the email GitHub verified, sent by hand from
  `support@ai4kanban.dev`, for the end of the preview and for a material change to either
  page. The app and a connected Slack channel are not notice routes.
- An event is kept while it is unresolved, then deleted 30 days after it reaches a final
  outcome, together with its deliveries, action and outcome.

## Answering a question away from the board

- A question is answered either by ticking an option or by typing a sentence, never both, the
  way the board's own Resolve works. Cloud holds a typed answer unchanged; an answer given in
  the app is applied at once, and one given anywhere else waits for the board's server.
- A question notifies the owners watching the release; a card never names a person. Any
  member may still open the card and answer — owner routing decides who is told, not who may
  write. Asking a named member is later work.
- A workspace cannot be left without an owner: the role change or removal that would is
  refused, because owner is the address a question is sent to.
- Pressing Implement in a Slack or Lark message records the decision in Cloud on the spot,
  from a phone included. It does not open the app and does not need the machine awake — the
  board's server picks it up when next reachable.
- A message shows enough to review the task — the summary, Worth noting, and Worth noting
  after implementation — so Cloud holds that text beside the event and everyone in the
  destination reads it.
- Revising or talking a card through from a message is not in the first release; the card
  link opens the app for anything else. Replying in a card's thread to chat with its agent is
  wanted after it, in a channel or a DM with no mention needed — which requires the app
  invited to the channel, and only a reply in a card's thread is kept.
- An account connects Lark by installing an AI4Kanban app listed in the cloud's own
  directory, so connecting is one button and the user registers nothing. Both
  `open.larksuite.com` and `open.feishu.cn` are listed, and a connection belongs to the cloud
  it was installed from.
- A conversation with the agent answers one turn at a time, whichever state that turn is in: a
  message sent while an earlier turn is still answering, or still waiting for a machine that is
  off, is refused saying which, rather than queued behind it.
- One event takes exactly one action, from whichever surface acts first. Cloud refuses a
  second and tells every other surface, so a message for an event already handled in the app
  is redrawn as answered rather than left pressable.

## How a Cloud board would be reached

- A Cloud board's repo holds one committed pointer to the workspace and the machine's own
  ignored files — no cards and no memory in git — so every clone opens the same workspace and
  export is how anyone gets committed markdown back. The machine keeps its own ignored copy of
  the board for the run's coding agent to work in, so a run reads and writes files on a Cloud
  board exactly as it does on a Local one.
- A Cloud board is reached from the installed app only until 0.9.0, when a workspace gets a
  URL: a public read-only board for anyone, and card review and Resolve for a signed-in
  account.
- A save finishes against the machine's own copy before the command returns and reaches the
  workspace behind it, so no edit waits on a round trip and the workspace ends up holding the
  latest card.
- A card is locked before it is written: one holder at a time on a 30-minute lease, taken
  again as often as its holder likes, and free for the next caller once it expires. That, not
  a synchronous save, is what stops two writers from overwriting each other.
- A writer that dies mid-upload loses the edits it had not sent: once its lock expires another
  writer takes the card, and the workspace's version comes back over the abandoned copy.
- A run whose card is taken over ends there: a lock renewal that finds another machine holding
  the card stops the run, replaces the machine's copy of that card with the workspace's and
  drops what the run wrote, so the user restarts on the card as it now reads.
- Two people changing one card gets the second write refused as a conflict naming the version
  the board holds now, and the caller re-reads that card — never a silent overwrite, never a
  message the user has to interpret.
- A Local board never meets that refusal: the app writes against the writer lease it takes,
  so passing the revision a screen read starts on Cloud, where one account on two machines
  already makes it real.
- Cloud out of reach opens the board read-only from the machine's copy, marked offline with
  when it was last read, and refuses every write until Cloud answers. It comes back live on the
  next read that reaches the workspace, with nothing to press. Only a call that never reached
  the service counts as offline; anything the workspace answered is shown as it stands.

## Cloud first, a team second

- A board in Cloud and a team sharing it are two pieces of work, not one. The workspace, its
  store, the app and CLI against it, onboarding and the browser surface serve one account on
  their own — the board survives the machine, opens on a phone and can be published read-only
  — and members, roles, a per-card writer and question routing are a layer on top of them.
- Deferring the team layer costs no rewrite: one owner on two machines already has two
  writers and the card lock settles that, so what a second person adds is the member half —
  the holder named on the card and the draft kept while they are offline — and membership is a
  forward-only migration that swaps one authorization predicate.
- The store is Supabase Postgres behind the Worker, as it shipped. The one-Durable-Object-per-
  workspace proposal that stood in the team group's plan is not the runtime this program has.

## The machine that runs the work

- It is called a **server**, everywhere a person can see it, including the `waiting for
  server` state every destination renders.
- A board has exactly one: a second attachment is refused rather than routed between, so a
  board whose server is off waits for that machine and no other. Routing across several is
  later work.
- An action taken on the board's own machine does not go through the server — the card page
  starts the delivery or writes the answer at once and records the Cloud action afterwards.
  `waiting for server` is for an action taken somewhere else.
- Cloud tells a teammate the server's whole runtime binding — each runtime the board names,
  and the harness and model that machine runs it as. Names only: never a key, an argument
  string or a path.
