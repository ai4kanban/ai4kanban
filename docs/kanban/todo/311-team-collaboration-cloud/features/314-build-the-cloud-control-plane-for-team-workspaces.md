---
title: Build the Cloud control plane for team workspaces
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [311]
modules: [cloud]
questions:
  - question: "[user] Cloud is invite-only per account (#326, #327), so a teammate an owner adds to a workspace must already have redeemed a code we approved. Does an owner's invitation admit that account to Cloud as well, or only make them a member?"
    mode: single
    options:
      - Only a member — every teammate still redeems a code we approve first, and a not-yet-admitted one presses #326's Request an invite. Capacity stays exactly the list we wrote, at the cost of us hand-approving every member of every preview team before it can test anything.
      - A member and an admitted account — adding a member admits them, so a team onboards itself once its first owner is in. Growth is then bounded only by the shared daily write budget and the 500 MB ceiling rather than by our list, and #321's pages have to say a workspace owner can admit people.
    recommend: [2]
---

Give each Cloud workspace one trusted place that decides who may change what and in what
order. 0.8.0's service knows one account at a time and everything in it belongs to that one
account: nothing groups two people into a team, nothing holds a card against a second
writer, and no write is attributed to a teammate.

## Worth noting
- **An owner can take a card away from a member mid-edit**: revoking a writer lease fences
  its holder at once and is recorded against the owner who did it, so a card a crashed or
  absent teammate is holding always has a way out. The cost is that the fenced member's
  unsaved draft cannot be saved and has to be re-applied by hand. Waiting out the
  120-second expiry instead leaves the card unwritable in two-minute stretches and does
  nothing about a node that keeps renewing.
- **Removing a member stops their next write, not their open screen**: nothing pushes to an
  open board in this version (#311), so a removed member keeps reading the board they
  already loaded and meets the removal on the first thing they try to change. Closing that
  window needs a live connection per open board, which is the read cost the preview's one
  shared daily budget cannot carry.
- **Deleting a workspace takes effect at once, and a mis-click is unrecoverable**: the
  confirmed operation removes the workspace and everything in it, which is what #321's
  privacy page already promises, and the preview keeps no backups to restore from. A grace
  window would give a mistaken owner a week to ask for it back, at the cost of a
  deleted-but-still-answering state #317 has to explain and a deleted workspace's rows held
  against the free tier meanwhile. An owner's export stays the team's only recoverable copy.

<!-- agent -->

## Today
- 0.8.0 landed the single-account half of Cloud. #326 records one account per verified
  sign-in, keeps the list of accounts admitted to the preview, reads the GitHub handle from
  `auth.identities` rather than from a token's rewritable `user_metadata`, and puts one owner
  check in front of every route — leaving open only the session and invite-request routes, so
  an account that is not admitted can still be named and can still ask. #327 admits an account
  with a redeemed invitation code.
- #318 registered an execution node against one account, with the delivery request, claim and
  outcome lifecycle that runs a local delivery from a Cloud approval.
- `cloud/` holds no workspace and no board table: two schemas — `cloud` for data, including
  0.8.0's accounts, nodes and events, `api` for the functions PostgREST serves — the day's
  write counter, the heartbeat the hourly run touches, and forward-only migrations. Every
  workspace and board table is this card's.
- A mutation is one `api` function and therefore one transaction, called by the Worker over
  PostgREST with the service role key. There is no second way in: neither schema grants
  anything to `anon` or `authenticated`.
- A refusal is `{ error: { code, message } }`, its `message` is shown to a user as it
  stands, and `RefusalCode` in `cloud/src/errors.ts` is the closed list a client matches on.
- Every mutation counts itself against the day's write budget through `cloud.count_write`,
  which aborts the transaction past the budget, so a refused write costs nothing.
- #312 landed the contract in `cli/src/lib/board/`: `OpEnvelope` carries a client-minted
  `opId`, the revision the caller expects, and the lease id; a mutation answers `ok`,
  `conflict` with the revision the board holds now, or `refused`. This card builds the half
  of it a Local board has no use for — spotting a duplicate `opId`, and a lease that holds
  across machines.
- The Supabase project, the GitHub OAuth app and the `api.ai4kanban.dev` route are stood up
  before this card runs, through `cloud/README.md`, "Standing up a new project", so its
  behavior is checked against a live service rather than the checkout alone (#311).

## Scope
- **Membership, not admission, opens a workspace**: every endpoint that reads a workspace or
  writes to it answers only that workspace's members, behind #326's admission check rather
  than in place of it. The session and invite-request routes #326 leaves open stay open —
  they are what names an account belonging to no workspace yet.
- **Two roles and no third**: an owner manages members, roles, execution nodes and the
  workspace itself; a member performs every ordinary board operation. No per-card
  permissions.
- **A member is one of #326's accounts inside one workspace**: the member row carries the
  workspace and the role, and reads the GitHub handle back from that account rather than
  keeping a second copy of it.
- **Any admitted account may create a workspace**: #326's admission check already refuses
  everyone else at every route, so this card adds no second invite list and no second refusal.
- **An owner adds and removes members and changes their roles**: the operations behind #317's
  member controls, each audited like any other change.
- **Execution nodes come under the workspace**: #318's node record gains the workspace and
  the member it belongs to, and an owner can list, rename and remove one.
- **The control plane allocates the stable ids**: workspace, member, execution node, card,
  delivery attempt and lease. Card ids stay the small integers the board already uses, so
  #315's import carries every card's number in unchanged.
- **Operation ids arrive with the caller**: #312 mints one per attempt, so the control plane
  records it, answers a retry carrying the same payload with the first result, and refuses
  the same id carrying a different one.
- **One transaction per mutation**: membership, lifecycle rules, operation uniqueness, the
  expected revision and an unexpired lease are checked, the change is applied, revisions
  advance, and an attributed audit event is appended — all of it or none of it.
- **One writer per card**: a 120-second lease renewed every 40 seconds, acquired by
  compare-and-set on the card's revision, with server time deciding expiry. A renewal moves
  the lease's expiry and neither the card's revision nor the operation ledger.
- **Expiry is lazy and fenced**: nothing sweeps for it; the next acquisition records the
  interruption, mints a new lease id and raises the fence, so a write from an expired or
  revoked holder is refused even after another member has taken the card.
- **An owner may revoke a live lease**: audited, and it fences the holder from that moment.
- **Membership and node removal bite on the next call**: the removed member's or node's next
  renewal, write and delivery confirmation are refused, and their live leases are
  invalidated.
- **A conflict is its own refusal**: it carries the revision the workspace holds now, so a
  client re-reads that one card rather than showing the user a sentence to interpret.
- **Workspace-wide changes take a maintenance lease**: granted only while no unexpired card
  lease is live — a crashed holder stops blocking the moment their lease expires, not when
  someone releases it — and it blocks new ones while held. A multi-card operation either
  commits whole or changes nothing.
- **A workspace always keeps an owner**: the role change or member removal that would leave
  none is refused, with the reason.
- **An owner can delete a workspace and everything in it, at once**: the operation #321's
  privacy page promises and #317 puts in front of an owner. Cards, members, execution nodes,
  leases, the operation ledger and the audit trail all go inside the confirmed call — no
  grace window, no deleted-but-answering state, and nothing left to restore from.
- **Deletion does not wait for a quiet workspace**: alone among workspace-wide changes it is
  not held behind the maintenance lease, so a card a crashed or absent member is still
  holding cannot block an owner; the same transaction fences every live holder.
- **A deleted workspace answers like one the caller never belonged to**: a member's write, a
  node's renewal, a delivery confirmation and a second delete all meet the refusal a
  non-member meets, so no client has to tell "gone" from "not yours" and nothing leaks
  whether a workspace once existed.
- **The trail outlives the member, not the workspace**: an audit event is never rewritten, so
  a removed member keeps a row naming their account and their events stay readable. Deleting
  the workspace is the one operation that removes them.
- **The operation ledger stays bounded**: the hourly run #323 already schedules drops
  operation records past their retention. Audit events are kept.

## Todo
- [ ] Add workspaces, members and roles on top of #326's account record, and put every
      workspace endpoint behind the membership check without closing the two routes #326
      leaves open.
- [ ] Add the owner operations behind #317's controls: add a member, remove one, change a
      role.
- [ ] Allocate stable workspace, member, node, card, delivery-attempt and lease ids, keeping
      card ids the board's own integers.
- [ ] Add revisions, the operation ledger and immutable attributed audit events inside each
      mutation's transaction.
- [ ] Check a retried operation id returns the first result, and a reused id with a
      different payload is refused.
- [ ] Bring #318's execution node under a workspace and a member, name, list and remove one,
      and check a removed node's next renewal, write and delivery confirmation are all
      refused.
- [ ] Add lease acquisition, renewal, expiry, release and owner revocation, and check a
      renewal moves neither the card's revision nor the ledger.
- [ ] Fence a delayed writer after expiry or revocation.
- [ ] Add the workspace maintenance lease and atomic multi-card operations.
- [ ] Refuse the last owner's demotion or removal, and say why.
- [ ] Add owner deletion of a workspace and everything stored in it, taking effect inside the
      call and fencing every live lease in the same transaction.
- [ ] Check that a later call naming a deleted workspace — a write, a renewal, a delivery
      confirmation, or the delete retried — meets the refusal a non-member meets.
- [ ] Answer a stale write with a conflict carrying the revision the workspace holds now.
- [ ] Prune operation records past their retention on the hourly run.
- [ ] Check concurrent writers, stale revisions, retries, membership removal and a
      workspace's deletion against a live workspace.

## Decided by the agent
- **What sign-in this card builds**: none of it. #323 verifies the token against the
  project's JWKS and registers the GitHub app, #326 signs a machine in, admits the account
  and renews the session, and #316 brings `akb` into that same session. This card is where an
  admitted account becomes a member of a workspace, and where being admitted stops being
  enough.
- **Where the preview's invite list lives**: in #326, not here. It admits an account to Cloud
  at all, and #327 hands it out as a code, so a second list gating workspace creation would
  refuse the same people twice with two messages to keep in step.
- **How many workspaces an admitted account may create**: no cap. The invite list bounds who
  is in the preview and #323's shared daily write budget and storage ceiling bound what they
  can spend, so a member keeping a work board and a side project costs a row rather than a
  limit to explain.
- **What fences a stale writer, given the contract carries no token**: the lease id. #312's
  `OpEnvelope` passes `opId`, the expected revision and the lease id and nothing else, so
  each acquisition mints a new lease id and a write naming one that is no longer current is
  refused. The rising fence is a column the control plane keeps for the audit trail, never a
  field a client sends, so nothing here reopens the contract.
- **How a node is named**: its machine's hostname when it registers, renameable by its member
  from #317's controls. An unnamed node is one an owner cannot tell apart when they have to
  remove one.
- **What a removed member leaves behind**: their member row, kept as a tombstone pointing at
  #326's account. Audit events are immutable and carry a member id, so dropping the row would
  leave a trail nobody can read, and the handle is read back through the account rather than
  copied here.
- **Why a workspace must always keep an owner**: #311 addresses a user-owned question to the
  owner role, so a workspace with no owner is a workspace whose questions reach nobody.
- **Where public read-only access went**: to #322, with the browser surface that would render
  it. Nothing in this release reads a board outside a signed-in app, so a switch here would
  have no reader.
- **Why the keep-awake query is not this card's**: #323 ships it — `api.service_heartbeat()`
  on an hourly Cron Trigger, deliberately outside the write budget. The only scheduled work
  this card adds is the ledger prune, hung off that same run rather than a schedule of its
  own.
- **What a retried delete gets back, once the ledger is gone with the workspace**: the
  refusal a non-member meets. The operation ledger lives in the workspace, so the row that
  would answer a retry with the first result goes in the same transaction; #312's client
  reads that refusal on a delete as the delete having happened, not as a failure to report.
- **What a deletion does not take**: the owner's #326 account and its admission, which are
  service data rather than workspace content. An owner who deleted by mistake can still create
  a fresh workspace and import their export into it, which is the nearest thing to a way back
  this card offers.
- **How this card is checked**: `cd cloud && npm run lint && npm test` and a migration read
  back by `npm run migrate -- --dry-run` for what the checkout can prove, then concurrency,
  fencing and deletion against the live project the service is stood up on before this card
  runs.

### Overruled by the user
- **Where an execution node gets its identity**: here. #316 holds leases from a node, #317
  manages nodes, and #318 lets "the same node" confirm a pending delivery — all of which need
  a node the control plane issued and can revoke. A node registers itself the first time a
  machine opens the workspace, under the member signed in on it.

## Source
- `plan.md`, "Control plane" and "Consistency and concurrency" — ID allocation, membership,
  revisions and idempotency, the lease policy and its fencing, and the metadata model these
  tables come from.
- `cloud/README.md` — the service this card writes inside, and the list a person works
  through to stand a project up.
- `cli/src/lib/board/contract.ts` — the envelope, the lease and the three answers a mutation
  gives, which #316's Cloud provider calls this control plane through.
- #326 and #327 — the account record, the admitted-accounts list, the provider-attested
  handle, the invitation code, and the one owner check every Cloud route already applies.
- #318 — the execution node this card brings under a workspace, and the delivery lifecycle
  whose confirmations a removed node or member has to be refused.
