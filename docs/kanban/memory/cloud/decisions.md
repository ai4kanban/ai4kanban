# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## What Cloud is, and what it is not

- Cloud relays; it does not hold a Local board. The Markdown board stays authoritative, and
  Cloud authenticates the user and relays revisioned events, actions, execution requests and
  outcomes.
- The hosted pages hold no setting a reader may write: Settings there is the account alone,
  and board and machine configuration stays in the app.
- Onboarding leads with a Local board; leading with Cloud waits on pricing and the
  open-source support policy.
- Shared boards, membership, roles and multi-user conflict handling follow the single-user
  relay rather than shipping with it.

## The invite-only preview

- Only an account we admit may sign in, so most people who download a public release meet a
  refusal. Open signup ships with pricing.
- A refused person asks with **Request an invite** in the refusal itself, recorded against
  their account and emailed to us. The site gets no invite page, no waitlist and no public
  thread, and no time is promised for a reply.
- Approving that request is how an invitation is given: it admits the account there and then
  and emails the person, with nothing typed back. An approval-written admission survives a
  GitHub rename; a hand-written row names a handle alone, so a rename un-admits it.
- Being added to a workspace is not an admission: a teammate must already be admitted in
  their own right.
- A feature planned for paying users opens to admitted accounts first, and its gate becomes
  payment when pricing lands.

## Where Cloud runs

- Cloudflare Workers for compute, on the account the site already deploys from, and a
  Supabase Postgres project of its own, in Frankfurt so an EU team's data stays in the EU.
- Supabase is on its free tier: the preview keeps no backups, and a free-tier limit refuses
  writes rather than producing a bill.
- Signing in is GitHub's own consent screen asking for `user:email` and nothing else,
  redirecting through the Supabase project's address — putting that redirect on our own name
  is a paid add-on the preview does not take.
- Turning Cloud on requires nothing new of `akb`: it publishes over `fetch` against the
  published Realtime protocol, so `akb` stays Node 18+ with no dependencies, and a runtime
  with no global `WebSocket` catches up through the Worker on the next command.
- The service was provisioned before the features that use it, so every card since is checked
  against a live service.

## What we publish about a user's data

- A privacy page and a terms page ship on the public site, live before the first outside
  person is invited, and the release that starts mailing a user is the one that carries them.
- Nullreach Ltd, registered in England and Wales, is the operator and data controller, and
  the terms are governed by English and Welsh law.
- Deleting takes effect at once with no recovery window, so an export is the only copy that
  survives a mis-click.
- No fixed notice period is promised: we may end the preview or close an account at any time,
  with reasonable notice where practical. Notice reaches an account at the address GitHub
  verified, sent by hand; the app and a connected chat are not notice routes.
- An event is kept while unresolved, then deleted 30 days after its final outcome.

## Answering a question away from the board

- A question is answered either by ticking an option or by typing a sentence, never both, the
  way Resolve works. An answer given in the app is applied at once; one given anywhere else
  waits for the board's server.
- A question notifies the owners watching the release and a card never names a person: owner
  routing decides who is told, not who may write. Asking a named member is later work.
- A workspace cannot be left without an owner, because owner is the address a question is
  sent to.
- A member's notification switch and watched release belong to the workspace rather than a
  machine, so they follow the member everywhere, and a new member starts with the switch on
  watching the newest open release.
- Moving the watched scope tells only the member who moved it; everyone else's bell fills
  quietly.
- Pressing a control in a chat message records the decision in Cloud on the spot, from a phone
  included, without opening the app or needing the machine awake.
- A message shows enough to review the card — the summary, Worth noting, and Worth noting
  after implementation — so everyone in the destination reads it.
- Revising or talking a card through from a message is later work; the card link opens the app
  for anything else. A conversation answers one turn at a time, and a message sent while a
  turn is still answering is refused saying so rather than queued.
- An account connects Lark by installing an app listed in the cloud's own directory, so
  connecting is one button; a connection belongs to the cloud it was installed from.
- Answering or implementing a card retires every ended notification it still has waiting.
  Landed is never retired: it is the success record.

## How a Cloud board is reached

- A Cloud board's repo holds one committed pointer to the workspace and the machine's own
  ignored files — no cards and no memory in git — so every clone opens the same workspace, and
  the machine keeps its own ignored copy for a run's coding agent to work in.
- Every board is member-only: a signed-out visitor is served nothing at all. Publishing a
  board read-only for a community is a later change, so the only board a community can read
  stays a `docs/kanban/` folder in a public repository.
- A save finishes against the machine's own copy before the command returns and reaches the
  workspace behind it, so no edit waits on a round trip.
- A card is locked before it is written — one holder on a 30-minute lease, renewable, free
  once it expires — and that, not a synchronous save, is what stops two writers overwriting
  each other. A writer that dies mid-upload loses the edits it had not sent.
- A run whose card is taken over ends there: the machine's copy is replaced with the
  workspace's and what the run wrote is dropped, so the user restarts on the card as it reads.
- Two people changing one card gets the second write refused as a conflict naming the current
  version — never a silent overwrite, never a message the user has to interpret. A Local board
  never meets that refusal.
- Cloud out of reach opens the board read-only from the machine's copy, marked offline with
  when it was last read, and refuses every write until Cloud answers. Only a call that never
  reached the service counts as offline.
- Turning cloud storage on always makes a new workspace, named after the project folder and
  editable on the confirmation — never a pick from existing ones, so two boards never merge
  into one workspace.
- Turning it off migrates the board back in full through the same page, keeping the workspace
  rather than deleting it, so a mis-click loses nothing.
- A migration waits for the runs already going, in both directions, so nothing written during
  the window is missed.

## Cloud first, a team second

- A board in Cloud and a team sharing it are two pieces of work: the workspace serves one
  account on its own, and members, roles, a per-card writer and question routing are a layer
  on top.
- Deferring the team layer costs no rewrite: one owner on two machines already has two writers
  and the card lock settles that, so membership is a forward-only migration swapping one
  authorization predicate.
- The store is Supabase Postgres behind the Worker; the one-Durable-Object-per-workspace
  proposal is not the runtime this program has.

## The machine that runs the work

- It is called a **server** everywhere a person can see it, including `waiting for server`.
- A board has exactly one: a second attachment is refused rather than routed between, so a
  board whose server is off waits for that machine. Routing across several is later work.
- An action taken on the board's own machine does not go through the server — it acts at once
  and records the Cloud action afterwards.
- Cloud tells a teammate the server's whole runtime binding, names only: never a key, an
  argument string or a path.

## The site's public forms

- **Spam protection**: server-side rate limits by visitor IP and submitted email only — no Turnstile or other human check, accepting that a scripted flood can reach the support inbox.
