# Team collaboration

Turn the mid-term direction in `docs/kanban/memory/goal.md` into a design we can argue with,
and a shipping order where every step is useful before the next one exists.

Local and Cloud are two first-class ways to host a board. Neither is the product default:
onboarding asks the user to create or open a Local board or a Cloud board. Both use the same UI
and `akb` workflows, but they have different authority and consistency models.

Cloud manages card lifecycles and team coordination. It never manages a codebase and never runs
agents. Each member's machine remains an execution node using its own repository, git tooling,
agent harness, and model account.

## Terms

- **Local board**: a board whose authoritative state is the local markdown and git history.
- **Cloud board**: a board whose shared card state and collaboration controls are authoritative in
  AI4Kanban Cloud.
- **Workspace**: a Cloud board together with its members, roles, memory, releases, and history.
- **Execution node**: a member's machine running `akb` against its own checkout.
- **Writer lease**: the exclusive right for one member or execution node to mutate one card.
- **Card metadata**: the card frontmatter, including lifecycle state, ownership, version, and
  delivery commit where applicable.
- **Card body**: the markdown content of the card. Cloud stores the shared body, but does not
  receive live drafts while a card is being edited.
- **Decision inbox**: the browser view where a member sees questions routed to them and performs
  card operations through the same access rules as every other client.

## The four problems (from goal.md)

Team collaboration is exactly these, in this order of difficulty:

1. **Identify members** — who is on this board, and who may do what.
2. **Route questions** — an agent's open question reaches the person who can decide, where they
   already are (browser, then IM).
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
- **Card metadata**: authoritative frontmatter and lifecycle transitions.
- **Card access**: atomic writer-lease acquisition, renewal, release, and conflict rejection.

Every mutation includes the card version and, after acquisition, the writer-lease ID. The server
checks access and advances the version atomically. A client-side editor badge is only a hint; it
is never the concurrency control.

A Local board implements the equivalent operations locally without calling the Cloud control
plane. Local and Cloud are peer board modes, not a primary mode plus an add-on.

### 2. Board data plane

- **Local board**: markdown files and git are authoritative for card metadata, bodies, memory,
  releases, and history.
- **Cloud board**: the Cloud database is authoritative for shared card state, memory, releases,
  and history. Clients keep an asynchronous whole-board cache for rendering.
- **While editing**: `akb` first acquires the writer lease and records the current frontmatter in
  Cloud. The body remains a local draft; there is no keystroke, document, or realtime body sync.
- **On completion**: `akb` uploads the final card body and final frontmatter in one lifecycle
  operation, then releases the writer lease.
- **Migration**: import moves a Local board into a Cloud workspace; export produces the markdown
  format again. Import/export is a bridge, not bidirectional replication.

All UI and agent mutations go through `akb`, including lifecycle-only changes. This lets the CLI
guarantee the acquire-record-complete sequence rather than relying on each client to remember it.

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
- **Leases recover from dead clients**: the active writer renews its lease. If it disappears, the
  lease expires and the lifecycle records an interrupted edit before another writer may acquire
  the card.
- **The server arbitrates stale clients**: the UI may show no editor because its board cache is
  stale. Its mutation still performs atomic acquisition against Cloud. If another writer exists
  or the card version changed, Cloud rejects the operation; the client refreshes that card and
  shows the current writer and state.
- **No merges**: conflicting mutations are refused, not merged. Final card bodies are uploaded
  only by the lease holder.

The React application hydrates its local state from a whole-board Cloud snapshot and updates it
asynchronously. V1 should choose the least expensive freshness policy that is adequate in use:
refresh after local mutations, on explicit refresh, and when the app regains focus; add lazy
periodic refresh while visible if needed. Webhook or push invalidation is justified only if the
measured collaboration benefit exceeds its infrastructure cost. None of these policies changes
the server-side conflict rule.

## Identity and roles

- **Login via GitHub**: the audience is developer teams and OSS projects; one provider is enough
  to start.
- **Two roles plus a switch**: `owner` manages settings, members, and releases; `member` performs
  normal board operations. A workspace is private by default and can be public read-only.
- **No per-card ACLs in v1**: card access means writer coordination, not a separate permission
  matrix. Workspace membership and role checks still apply to every operation.
- **Attribution everywhere**: every answer, approval, veto, edit, and lifecycle transition
  records who performed it.

## Question routing and the decision inbox

- **Questions get an owner**: an agent proposes an assignee from memory; unassigned questions
  land in a shared queue any member can take.
- **The inbox uses normal card operations**: answering a question or editing a deterministic
  field must acquire the card's writer lease. It cannot bypass an active local agent or editor.
- **IM is delivery, not storage**: Slack comes after the browser inbox. Replies flow through the
  same authenticated card operation and are attributed to the responder.
- **Answers join memory**: after the card mutation succeeds, the decision is stored once in the
  shared, traceable memory.

## External systems

- **GitHub Issues is the community's door**: import an issue as a proposed card. External comments
  are suggestions and cannot directly overwrite the authoritative board.
- **Progress mirrors outward**: comments or labels may reflect lifecycle state, but the external
  system is not another writable replica.
- **Linear and others follow the same shape**: suggestions come in, progress goes out, and one
  Local or Cloud board remains authoritative.

## Shipping order

Each step establishes a boundary used by the next one. Local and Cloud appear as peers wherever
the board is selected or opened.

1. **Board provider boundary (#55)**: define the operations both Local and Cloud providers answer,
   including versions, lifecycle mutations, and conflict results. Do not encode Local as an
   implicit fallback or default.
2. **GitHub Issues intake**: import issues as proposed cards and mirror progress back, using the
   provider boundary rather than filesystem-only writes.
3. **Decision inbox, single-player**: validate remote question answering and deterministic card
   operations before adding team routing.
4. **Cloud control plane**: ID allocation, GitHub login, workspaces, owner/member access, card
   metadata, writer leases, and atomic stale-version rejection.
5. **Cloud board data plane**: import/export, whole-board snapshots, asynchronous React cache
   refresh, and the `akb` acquire-frontmatter-final-body lifecycle protocol.
6. **Team delivery loop**: local execution and git landing onto main, delivery commit recorded in
   card metadata, shared inbox routing, lease recovery, and conflict UX.
7. **Slack delivery**: send questions where members already work; replies use the same card
   mutation path.

## Non-goals

- **No Cloud codebase management**: no hosted repositories, worktrees, agents, execution, merges,
  landing, or model keys.
- **No realtime card editing**: no collaborative document editor, live draft body, CRDT, or body
  merge protocol.
- **No client-side concurrency guarantee**: background refresh improves freshness but never grants
  permission to write.
- **No Local/Cloud bidirectional sync**: a board has one authoritative provider. Import and export
  move snapshots across the boundary.
- **No fine-grained permissions**: two roles and a public read-only switch until real teams need a
  richer policy.
- **No automatic dispatch in v1**: a member chooses a card and starts local execution. Scheduling
  work across nodes is a separate feature.

## Open questions for discussion

- **Refresh policy**: is focus/mutation/manual refresh fresh enough, or does active board use
  justify lazy polling? Measure this before paying for webhook or push infrastructure.
- **Lease duration and recovery**: how long may an edit go without a heartbeat, and what explicit
  recovery may an owner perform after a crashed node?
- **Landing proof**: is a locally verified main-branch commit ID sufficient, or must Cloud verify
  the remote default branch before accepting the delivered transition? Verification must not turn
  into Cloud codebase management.
- **Partial completion**: if git landing succeeds but final-body upload fails, which idempotency key
  lets `akb` safely retry the Cloud completion without duplicating history?
- **History import**: should `record.csv` be imported, or should a Cloud workspace start metrics
  fresh with a link to its Local history?
- **OSS support policy**: does support for qualifying open-source projects shape pricing now or
  after the collaboration model is proven?

## Existing cards

- **#57/#55/#59 (board storage)**: #55 defines peer Local and Cloud providers; the Cloud provider
  must expose lifecycle and conflict semantics rather than pretending to be a realtime filesystem.
- **#250 (friendly task import)** and **#56 (Obsidian)**: intake should extend #250's shape rather
  than create a separate write path.
- **#300 (auto-delivery)**: its local run state and git landing feed the Cloud lifecycle. Cloud
  records coordination and the delivered commit but does not absorb execution or codebase duties.
