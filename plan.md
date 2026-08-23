# Team collaboration

Turn the mid-term direction in `docs/kanban/memory/goal.md` into a design we can argue with,
and a shipping order where every step is useful before the next one exists.

The open-source product stays a local, single-player board. The hosted team version —
AI4Kanban Cloud — adds identity, routing, and sync on top of it. Cloud never runs agents:
every member's machine is their own execution node with their own model account.

## Terms

- **Workspace**: one team's board on Cloud — cards, memory, releases, history, members.
- **Member**: a person in a workspace, identified by login, with a role.
- **Execution node**: a member's machine running `akb`, connected to a workspace. It pulls
  work, runs agents locally, and reports run state back.
- **Claim**: an exclusive hold on a card by one member (or their node) so two agents never
  work the same card.
- **Decision inbox**: the browser view where a member sees the questions routed to them,
  answers agents, and edits deterministic fields.

## The four problems (from goal.md)

Team collaboration is exactly these, in this order of difficulty:

1. **Identify members** — who is on this board, and who may do what.
2. **Route questions** — an agent's open question reaches the one person who can decide,
   where they already are (browser, then IM).
3. **Prevent double work** — one card, one claimant, across all machines.
4. **One memory** — every decision, veto, and answer lands in the same traceable memory,
   attributed to a person.

Everything below either solves one of these or is scaffolding for one.

## What stays open source, what is Cloud

- **Open source**: the board format, `akb`, the local UI, the desktop app, all flows, all
  execution. A solo user never needs an account.
- **Cloud**: the authoritative database for team workspaces, members and roles, the
  decision inbox, question routing, IM delivery, claims, and sync between nodes.
- **The seam is the storage layer (#55)**: Cloud is one more backend behind the same
  read/write interface the markdown board answers. The UI and flows do not know which one
  they are on. This is why #55 ships first.
- **Local-first stays true as promised**: the decisions memory already settles this —
  local-first is a promise about the default backend, not every backend. Moving a board to
  Cloud is the user's explicit choice, made with the one move command from #55.

## Storage and migration

- **Cloud is authoritative for a Cloud board**: no merge protocol, no CRDT. Nodes read and
  write through the API; the server serializes writes the way the board writer from the
  auto-implement design already serializes them locally. That design generalizes: the
  repository-wide writer becomes a workspace-wide writer.
- **Import, not sync**: `docs/kanban/` migrates to a workspace in one command — cards,
  memory, releases, `record.csv` history. After the move the git copy is a snapshot, not a
  replica. Two authoritative copies is how boards diverge.
- **Export always works**: a workspace can dump back to the markdown format at any time.
  No lock-in; this is the trust story for an open-source audience.
- **Code never moves**: repos, worktrees, branches, and landings stay exactly as the
  auto-implement design built them, on each member's machine.

## Identity and roles

- **Login via GitHub**: the audience is developer teams and OSS projects; one provider is
  enough to start.
- **Two roles plus a switch**: `owner` (settings, members, releases) and `member`
  (everything else). A workspace is private by default; an owner may flip it to public
  read-only so a community can watch the roadmap. No per-card or per-field ACLs.
- **Attribution everywhere**: every answer, approval, veto, and edit records who did it.
  This is what makes problem 4 solvable — memory entries carry a name.

## Question routing and the decision inbox

- **Questions get an owner**: an open question carries an assignee. The agent proposes one
  from memory (who decided similar things before); unassigned questions land in a shared
  queue any member can take.
- **Inbox v1 is single-player**: a browser page — usable from a phone — listing every open
  question on your boards, with the card's context inline: answer, or edit the
  deterministic fields directly. This is valuable before any team exists (goal.md's
  "decide from any device") and it is the exact surface Cloud later routes to.
- **IM delivery comes after the inbox works**: Slack first. The message carries the
  question and context; the answer flows back onto the card as if typed in the inbox. IM
  is a delivery channel, never a second store.
- **An answer is a board write**: it goes through the writer, lands on the card, and joins
  the decisions memory with attribution — same path as today, plus a name.

## Claims: one card, one agent

- **Claiming is explicit**: starting a run claims the card in the workspace. Another
  member's UI shows the card as claimed and by whom; starting a second run is refused, not
  merged.
- **Claims expire**: a node that goes silent releases its claim after a timeout, with the
  run marked interrupted — same recovery story as the auto-implement run states, lifted to
  the workspace.
- **Dispatch stays human**: v1 has no scheduler assigning cards to nodes. A member pulls a
  card and runs it. Automatic dispatch is a later feature with its own limits, as the
  auto-implement plan already requires for anything that starts cards on its own.

## External systems

- **GitHub Issues is the community's door**: import an issue as a proposed card —
  suggestion only, never a direct write to the board. Progress mirrors back to the issue
  as comments or labels. The board stays authoritative; goal.md is explicit that external
  comments cannot overwrite it.
- **This ships before Cloud**: import is a near-term goal.md item and a solo-user feature.
  The OSS-team story ("community files issues, maintainer's board triages them") works
  with a local board plus import, no Cloud needed.
- **Linear and others follow the same shape**: intake as suggestions, mirror progress out,
  one authoritative board.

## Shipping order

Every step is a release a solo user benefits from; Cloud multiplies existing features
instead of inventing new ones. Steps 1–3 are pre-Cloud and near-term; 4–6 are the team
version.

1. **Storage layer (#55)**: the read/write seam every backend answers. Already a ready
   card; unblocks GitHub Projects (#59) and Cloud alike.
2. **GitHub Issues intake**: import issues as proposed cards, mirror progress back. The
   OSS community loop with zero infrastructure.
3. **Decision inbox, single-player**: answer your own agents' questions from a browser or
   phone. Requires a small relay service — the first Cloud-shaped component, and the
   natural place for accounts to appear.
4. **Workspaces**: Cloud backend behind #55, GitHub login, owner/member, the one-command
   import from `docs/kanban/`, export back to markdown, public read-only switch.
5. **Team inbox and claims**: assignees on questions, routing, claimed cards visible
   across nodes, claim expiry. Problems 2 and 3 done.
6. **Slack delivery**: questions where members already work; answers flow back.

## Non-goals

- **Cloud does not run agents**: no hosted execution, no holding model keys. Machines and
  accounts stay the members' own.
- **No realtime co-editing**: cards are claimed and edited whole; this is a kanban, not a
  document editor.
- **No bidirectional git sync**: a board is markdown-in-git or Cloud, never both
  authoritative. Export is the bridge.
- **No fine-grained permissions**: two roles and a public switch until real teams ask for
  more.

## Open questions for discussion

- **Where does the inbox relay live** — is step 3 a thin hosted service from day one, or
  can it start as tunnel-to-your-desktop with no account? Hosted is simpler and seeds
  Cloud; tunnel keeps step 3 fully local.
- **Is `record.csv` history worth importing**, or does a workspace start its metrics
  fresh with a link back to the git history?
- **OSS support policy**: goal.md promises support for qualifying open-source projects,
  policy to be published — does that shape the pricing model now or later?
- **Does step 2 need the storage layer**, or is intake purely additive (it only proposes
  cards) and shippable in parallel with #55?

## Existing cards

- **#57/#55/#59 (board storage)**: this plan makes #55 the foundation and adds Cloud as a
  second backend after #59; the group's scope holds.
- **#250 (friendly task import)** and **#56 (Obsidian)**: intake-adjacent; step 2 should
  extend #250's shape, not duplicate it.
- **#300 (auto-delivery)**: the run states, board writer, and claims here are the same
  machinery lifted to a workspace — no conflict, one dependency direction.
