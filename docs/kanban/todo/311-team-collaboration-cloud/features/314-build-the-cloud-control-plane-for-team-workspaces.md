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
  - question: "[user] An owner deleting a workspace is irreversible and the preview keeps no backups, so one mis-click destroys a team's board with nothing to restore it from. Does delete take effect at once, or after a grace window?"
    mode: single
    options:
      - At once — the workspace and everything in it go inside the confirmed operation. It is the simplest thing to build and exactly what #321's privacy page promises, and a mistake is unrecoverable.
      - Stop answering at once, drop the rows seven days later on the hourly run — an owner who deleted by mistake can ask us to bring it back until then. Costs one more state #317 has to explain, and holds a deleted workspace's rows against the 500 MB free tier meanwhile.
    recommend: [2]
---

Give each Cloud workspace one trusted place that decides who may change what and in what
order. The service #323 stood up stops at a verified sign-in, so today any GitHub account
reaches it, nothing holds a card against a second writer, and no write is attributed to
anyone.

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

<!-- agent -->

## Today
- `cloud/` holds the service and nothing about a board: two schemas — `cloud` for data,
  `api` for the functions PostgREST serves — the day's write counter, the heartbeat the
  hourly run touches, and forward-only migrations. Every board table is this card's.
- A mutation is one `api` function and therefore one transaction, called by the Worker over
  PostgREST with the service role key. There is no second way in: neither schema grants
  anything to `anon` or `authenticated`.
- A refusal is `{ error: { code, message } }`, its `message` is shown to a user as it
  stands, and `RefusalCode` in `cloud/src/errors.ts` is the closed list a client matches on.
- Every mutation counts itself against the day's write budget through `cloud.count_write`,
  which aborts the transaction past the budget, so a refused write costs nothing.
- `/v1/session` and `/v1/self-check` stop at a verified token, so any signed-in GitHub
  account can call them and spend the service's daily budget.
- #312 landed the contract in `cli/src/lib/board/`: `OpEnvelope` carries a client-minted
  `opId`, the revision the caller expects, and the lease id; a mutation answers `ok`,
  `conflict` with the revision the board holds now, or `refused`. This card builds the half
  of it a Local board has no use for — spotting a duplicate `opId`, and a lease that holds
  across machines.
- The Supabase project, the GitHub OAuth app and the `api.ai4kanban.dev` route do not exist
  yet; `cloud/README.md`, "Standing up a new project", is the list a person works through.
  Until it is run, this card is checked from the checkout alone (#311).

## Scope
- **Membership, not sign-in, opens a workspace**: every endpoint that reads a workspace,
  writes to it, or spends the daily budget answers only that workspace's members, and
  `/v1/session` and `/v1/self-check` come behind the same check.
- **Two roles and no third**: an owner manages members, roles, execution nodes and the
  workspace itself; a member performs every ordinary board operation. No per-card
  permissions.
- **A member is the GitHub identity the provider recorded**: their handle comes from
  `auth.identities`, never from the sign-in token's `user_metadata`, which the account
  holder can rewrite.
- **Only an invited GitHub account may create a workspace**: an uninvited one is refused
  with a message saying the preview is closed and how to ask. Owners still invite members
  into a workspace they already own.
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
- **Workspace-wide changes take a maintenance lease**: granted only while no card lease is
  live, blocking new ones, and a multi-card operation either commits whole or changes
  nothing.
- **A workspace always keeps an owner**: the role change or member removal that would leave
  none is refused, with the reason.
- **An owner can delete a workspace and everything in it**: the operation #321's privacy
  page promises and #317 puts in front of an owner.
- **The trail outlives the member**: an audit event is never rewritten, so a removed member
  keeps a row carrying their GitHub handle and their events stay readable.
- **The operation ledger stays bounded**: the hourly run #323 already schedules drops
  operation records past their retention. Audit events are kept.

## Todo
- [ ] Add workspaces, members and roles, and bring every endpoint — `/v1/session` and
      `/v1/self-check` included — behind the membership check.
- [ ] Read a member's GitHub handle from `auth.identities`, and check that rewriting
      `user_metadata` changes nothing about who they are.
- [ ] Gate workspace creation on the invite list, and check an uninvited account is refused
      with a reason.
- [ ] Allocate stable workspace, member, node, card, delivery-attempt and lease ids, keeping
      card ids the board's own integers.
- [ ] Add revisions, the operation ledger and immutable attributed audit events inside each
      mutation's transaction.
- [ ] Check a retried operation id returns the first result, and a reused id with a
      different payload is refused.
- [ ] Register, name, list and remove execution nodes, and check a removed node's next
      renewal, write and delivery confirmation are all refused.
- [ ] Add lease acquisition, renewal, expiry, release and owner revocation, and check a
      renewal moves neither the card's revision nor the ledger.
- [ ] Fence a delayed writer after expiry or revocation.
- [ ] Add the workspace maintenance lease and atomic multi-card operations.
- [ ] Refuse the last owner's demotion or removal, and say why.
- [ ] Add owner deletion of a workspace and everything stored in it.
- [ ] Answer a stale write with a conflict carrying the revision the workspace holds now.
- [ ] Prune operation records past their retention on the hourly run.
- [ ] Check concurrent writers, stale revisions, retries and membership removal, against a
      live workspace once the project is provisioned.

## Decided by the agent
- **What sign-in this card builds**: none of it. #323 verifies the token against the
  project's JWKS and registers the GitHub app; #316 signs a machine in and renews its
  session. This card is where a verified identity becomes a member of a workspace, and
  where being signed in stops being enough.
- **Why neither the invite check nor a member's handle reads the token's metadata**:
  Supabase's `user_metadata` is written by the account holder, so a handle taken from it can
  be set to anyone's and the invite check would be spoofable. `auth.identities.identity_data`
  is the provider's own record, and a `security definer` function in `api` reads it.
- **What fences a stale writer, given the contract carries no token**: the lease id. #312's
  `OpEnvelope` passes `opId`, the expected revision and the lease id and nothing else, so
  each acquisition mints a new lease id and a write naming one that is no longer current is
  refused. The rising fence is a column the control plane keeps for the audit trail, never a
  field a client sends, so nothing here reopens the contract.
- **Where a team execution node gets its identity**: here. #325 establishes a single-user
  execution node first, but #316's leases and #317's controls need a member-owned node the
  team control plane can issue and revoke. A node registers the first time its machine opens
  the workspace, under the member signed in on it.
- **How a node is named**: its machine's hostname when it registers, renameable by its member
  from #317's controls. An unnamed node is one an owner cannot tell apart when they have to
  remove one.
- **What a removed member leaves behind**: their member row, kept as a tombstone with the
  GitHub handle. Audit events are immutable and carry a member id, so dropping the row would
  leave a trail nobody can read.
- **Why a workspace must always keep an owner**: #311 addresses a user-owned question to the
  owner role, so a workspace with no owner is a workspace whose questions reach nobody.
- **How an invite is handed out**: as rows of allowed GitHub logins in `cloud`, added from
  the Supabase SQL console and checked at workspace creation. Nothing builds an admin surface
  for a handful of rows while the preview is invite-only, and an entry can be removed again.
- **Where public read-only access went**: to #322, with the browser surface that would render
  it. Nothing in this release reads a board outside a signed-in app, so a switch here would
  have no reader.
- **Why the keep-awake query is not this card's**: #323 ships it — `api.service_heartbeat()`
  on an hourly Cron Trigger, deliberately outside the write budget. The only scheduled work
  this card adds is the ledger prune, hung off that same run rather than a schedule of its
  own.
- **What this card can prove before the project is provisioned**: `cd cloud && npm run lint
  && npm test`, and a migration read back by `npm run migrate -- --dry-run`. Anything that
  needs a live workspace is recorded as outstanding rather than reported as checked (#311).

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
