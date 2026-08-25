# Team collaboration

Local is the board onboarding leads with, and Cloud is an explicit choice beside it: an
invite-only preview of the hosted, collaborative board. Leading with Cloud waits for pricing
and the open-source support policy. Both use the same UI and `akb` workflows, but they have
different authority and consistency models.

Cloud manages card lifecycles and team coordination. It never manages a codebase and never runs
agents. Each member's machine remains an execution node using its own repository, git tooling,
agent harness, and model account.

## Terms

- **Local board**: a board whose authoritative state is the local markdown and git history.
- **Cloud board**: a board whose shared card state and collaboration controls are authoritative in
  AI4Kanban Cloud.
- **Workspace**: a Cloud board together with its members, roles, memory, releases, and history.
- **Execution node**: a member's machine running `akb` against its own checkout.
- **Writer lease**: the exclusive, time-bounded right for one member or execution node to mutate
  one card.
- **Portable card metadata**: lifecycle fields that survive Local/Cloud import and export, such as
  stable card ID, status, ownership, and delivery commit.
- **Coordination metadata**: Cloud-only revisions, leases, fencing tokens, operation records, and
  audit attribution. It does not belong in exported card frontmatter.
- **Card body**: the markdown content of the card. Cloud stores the shared body, but does not
  receive live drafts while a card is being edited.

## The four problems (from goal.md)

Team collaboration is exactly these, in this order of difficulty:

1. **Identify members** — who is on this board, and who may do what.
2. **Route questions** — an agent's open question reaches the person who can decide. Event,
   notification-center, and IM behavior are specified in [notify-plan.md](notify-plan.md).
3. **Prevent double work** — one card, one writer, across all machines and all mutations.
4. **One memory** — every decision, veto, and answer lands in the same traceable memory,
   attributed to a person.

Everything below either solves one of these or is scaffolding for one.

## Three-tier architecture

### 1. Control plane

The Cloud control plane coordinates a Cloud board. It owns:

- **ID allocation**: stable workspace, card, member, operation, and lease IDs.
- **Authentication**: who the caller is.
- **Member access**: workspace membership and role checks.
- **Lifecycle invariants**: authoritative portable card metadata and valid state transitions.
- **Revision and idempotency**: per-card and workspace revisions, operation deduplication, and
  immutable audit events.
- **Card access**: atomic writer-lease acquisition, renewal, release, expiry, revocation, and
  conflict rejection.
- **Consistent reads**: snapshot cursors so a client knows which board revision it rendered.

Every durable domain mutation carries a client-generated operation ID and the expected resource
revision. Card mutations also carry the current lease ID and fencing token. In one database
transaction, the server checks membership, lifecycle rules, operation uniqueness, revision, and
the unexpired lease; applies the mutation; advances the revisions; appends the audit event; and
stores the operation result. Retrying the same operation ID with the same payload returns that
result; reusing it with a different payload is rejected. Lease heartbeats are conditional updates
of the current lease, not durable domain operations, so they do not grow the operation ledger.

Acquiring a lease is an atomic compare-and-set on the card revision. Each successful acquisition
increments a monotonic fencing token. This makes a delayed request from an expired or revoked
writer fail even after another writer has acquired the card. Lease renewal changes only the lease
expiry, not the card revision. Server time decides expiry. A client-side editor badge is only a
hint; it is never the concurrency control.

Workspace-wide mutations such as import use the expected workspace revision and a short
workspace maintenance lease. It can be acquired only with no live card leases and blocks new card
lease acquisition. Other multi-card operations either commit atomically while locking their
affected rows in stable card-ID order or fail without changing any card. They never acquire card
leases one at a time and leave partial results.

A Local board implements the equivalent operations locally without calling the Cloud control
plane. It remains supported, but it is not the default onboarding path.

### 2. Board data plane

- **Local board**: markdown files and git are authoritative for card metadata, bodies, memory,
  releases, and history.
- **Cloud board**: the Cloud database is authoritative for shared card state, memory, releases,
  and history. Clients keep an asynchronous whole-board cache for rendering.
- **While editing**: `akb` first acquires the writer lease and records the current frontmatter in
  Cloud. The body remains a local draft; there is no keystroke, document, or realtime body sync.
- **On completion**: `akb` first uploads and freezes the final body and metadata in a durable
  delivery attempt. It then lands the code locally and confirms the attempt with the verified
  main-branch commit ID. Confirmation is idempotent, marks the card delivered, and releases the
  lease.
- **Migration**: import moves a Local board into a Cloud workspace; export produces the markdown
  format again. Import/export is a bridge, not bidirectional replication.

The CLI and Cloud UI use the same provider operation contract and Cloud endpoints, including for
lifecycle-only changes. No client gets a privileged write path around the control plane.

### Metadata model

- **Portable card metadata** keeps the existing board fields and adds `delivery_commit` only when
  a card is delivered. Stable card IDs are preserved across import and export.
- **Cloud card rows** add server-owned `revision`, monotonic `lease_epoch`, `body_hash`,
  `updated_at`, and `updated_by`.
- **Lease rows** have at most one current row per card and hold `lease_id`, holder member and
  execution node, fencing token, `expires_at`, and last renewal time.
- **Operation and event rows** hold the operation ID, payload hash, result revision, actor, time,
  and immutable audit payload.
- **Delivery attempts** hold their own ID, frozen card revision and body hash, state, and eventual
  delivery commit.
- **Workspace rows** hold a workspace revision, snapshot cursor, schema version, and any active
  maintenance lease.

Revisions, lease data, delivery-attempt state, and operation IDs are API/database coordination
state; do not add them to portable frontmatter. A cached Cloud card carries its revision in the
provider envelope, while an exported Local board is standalone.

### Local-to-Cloud history import

Import is a single maintenance operation into a new, empty workspace. It preserves current cards,
stable card IDs, hierarchy, releases, memory, and the append-only events in `record.csv`.
Historical rows are marked as imported and retain their original time, event, card reference, and
detail; they are not falsely attributed to a Cloud member. The import operation records who
performed the migration and the source board fingerprint, so retrying it cannot duplicate
history. Repository and git history stay local and are never uploaded.

### 3. Codebase data plane

The codebase always remains on execution nodes:

- repositories, worktrees, working copies, branches, commits, merges, and credentials stay local;
- a completed card is delivered as a commit landed on the repository's main branch;
- Cloud may record the delivery commit ID as card metadata, but never receives or manipulates the
  code, checks out a repository, lands a commit, or resolves a merge;
- agents execute locally with the member's harness and model account.

Cloud therefore manages the card lifecycle around delivery, not the delivery mechanics or the
codebase itself. A card cannot be marked delivered until the local landing succeeds.

## Consistency and concurrency

- **One writer per card**: every card mutation uses the same exclusive writer lease, regardless
  of whether it edits frontmatter, answers a question, changes lifecycle state, or completes a
  run. Other clients may read the card but cannot mutate it while the lease is held.
- **Lease policy**: a lease lasts 120 seconds and an active writer renews it every 40 seconds. If
  connectivity is lost past expiry, the draft remains local but the client must reacquire and
  compare the latest card revision before continuing.
- **Recovery is lazy and fenced**: no expiry job is required. The next read treats an expired lease
  as inactive; the next acquisition records the interruption and issues a higher fencing token.
  An owner may explicitly revoke a live lease, which is audited and immediately fences the old
  writer.
- **The server arbitrates stale clients**: the UI may show no editor because its board cache is
  stale. Its mutation still performs atomic acquisition against Cloud. If another writer exists
  or the card version changed, Cloud rejects the operation; the client refreshes that card and
  shows the current writer and state.
- **No merges**: conflicting mutations are refused, not merged. Final card bodies are uploaded
  only by the lease holder.
- **Membership changes take effect on every write**: removing a member or execution node causes
  its next renewal or mutation to fail; revocation also invalidates its active leases.

The React application hydrates from one whole-board Cloud snapshot. V1 does not poll, refresh on
focus, or subscribe to push updates. A successful mutation returns the changed resources and new
snapshot cursor; a rejected stale write refreshes only the affected card; and the user can refresh
explicitly. This keeps read cost low. Write consistency still comes entirely from atomic server
checks, never cache freshness.

### Delivery recovery

Uploading and freezing the final card before git landing removes the dangerous case where landing
succeeds but the final body never reaches Cloud. If landing fails, `akb` aborts the delivery
attempt and returns the card to its prior lifecycle state. If landing succeeds but confirmation
fails, it retries the same attempt ID and commit ID; the server returns the original result after
success. A crashed client leaves an explicit `delivery_pending` attempt that blocks ordinary card
writes. The same authenticated execution node or an owner can confirm or abort it after checking
the repository. Confirmation succeeds only while that attempt and its frozen card revision are
still current; aborting it fences delayed confirmation requests.

For v1, proof of landing is the commit ID after the execution node locally verifies that the
commit is reachable from the configured local main branch. Cloud records the commit, branch,
member, execution node, and verification time, but does not contact or manage a git remote.

## Identity and roles

- **Login via GitHub**: the audience is developer teams and OSS projects; one provider is enough
  to start.
- **Two roles plus a switch**: `owner` manages settings, members, and releases; `member` performs
  normal board operations. A workspace is private by default and can be public read-only.
- **No per-card ACLs in v1**: card access means writer coordination, not a separate permission
  matrix. Workspace membership and role checks still apply to every operation.
- **Attribution everywhere**: every answer, approval, veto, edit, and lifecycle transition
  records who performed it.

## Question routing

[notify-plan.md](notify-plan.md) owns question eligibility, notification content, the browser
notification center, deduplication, and IM delivery. This plan adds only the shared write rule:
resolving a question uses the normal leased card mutation, and its answer, attribution, audit
event, and memory update commit atomically.

## External systems

- **GitHub Issues is the community's door**: import an issue as a proposed card. External comments
  are suggestions and cannot directly overwrite the authoritative board.
- **Progress mirrors outward**: comments or labels may reflect lifecycle state, but the external
  system is not another writable replica.
- **Linear and others follow the same shape**: suggestions come in, progress goes out, and one
  Local or Cloud board remains authoritative.

## Shipping order

Each step establishes a boundary used by the next one. Product onboarding leads with Local and
offers Cloud beside it as an explicit, invite-only choice.

1. **Board provider boundary (#312)**: define the operations both Local and Cloud providers answer,
   including revisions, idempotency, lifecycle mutations, and conflict results. Local is the
   default provider; provider selection is always explicit.
2. **GitHub Issues intake (#313)**: import issues as proposed cards and mirror progress back, using the
   provider boundary rather than filesystem-only writes.
3. **Cloud control plane (#314)**: ID allocation, GitHub login, workspaces, owner/member access,
   revisions, operation ledger, audit events, fenced writer leases, and atomic conflict handling.
4. **Cloud board data plane (#315/#316)**: full Local-board import including `record.csv`, export, whole-board
   snapshots, targeted conflict refresh, and the acquire-draft-prepare-confirm lifecycle.
5. **Team delivery loop (#318)**: local execution, prepared delivery, git landing onto main, idempotent
   confirmation, recovery, and conflict UX.
6. **Question routing and delivery (#319/#320)**: implement [notify-plan.md](notify-plan.md) against the same
   authenticated, leased mutation path.

## Non-goals

- **No Cloud codebase management**: no hosted repositories, worktrees, agents, execution, merges,
  landing, or model keys.
- **No realtime card editing**: no collaborative document editor, live draft body, CRDT, or body
  merge protocol.
- **No client-side concurrency guarantee**: cache refresh improves freshness but never grants
  permission to write.
- **No Local/Cloud bidirectional sync**: a board has one authoritative provider. Import and export
  move snapshots across the boundary.
- **No fine-grained permissions**: two roles and a public read-only switch until real teams need a
  richer policy.
- **No automatic dispatch in v1**: a member chooses a card and starts local execution. Scheduling
  work across nodes is a separate feature.

## Existing cards

- **#311/#312 (team collaboration and providers)** replace the old generic storage group. The
  Cloud provider exposes lifecycle and conflict semantics rather than pretending to be a filesystem.
- **#250 (friendly task import)** and **#56 (Obsidian)**: intake should extend #250's shape rather
  than create a separate write path.
- **Existing auto-delivery**: its local run state and git landing feed #318's Cloud lifecycle. Cloud
  records coordination and the delivered commit but does not absorb execution or codebase duties.
