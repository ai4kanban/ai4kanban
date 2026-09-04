---
title: Bring team collaboration to AI4Kanban Cloud
priority: high
roi: high
status: ready
release: 0.9.0
blocked_by: []
related: [328, 375, 376]
modules: [cloud, local-ui]
questions: []
verify:
  - "Two GitHub accounts on two machines share one workspace end to end: the owner adds the second, who opens the board from a clone that commits only the pointer, is refused a card the owner is holding, and raises a user question that reaches the owner and is answered by them."
  - "The three published pages describe the team this group actually built: /cloud, /privacy and /terms on ai4kanban.dev name the shared board's members and their roles as they were shipped; no paragraph still says the release has no members and no roles; and the legal pages' effective date moved with the change."
---

Let a team share one authoritative Cloud board while every member keeps code and agent work
on their own machine. #373 puts a board in Cloud and reaches it from a browser, but it holds
one account's board: a second contributor cannot be identified, cannot be reached when a
question needs an answer, and nothing stops two machines from changing the same card. This
is a group task; each piece is its own subtask in this folder.

## Worth noting
- **This group needs a Cloud board, not the other way round**: #373 ships the workspace, its
  store, the app and CLI against it and the browser surface for one account, and everything
  here is a layer on top — members, a per-card writer, and routing a question to the person
  who can answer it.
- **A shared board changes when you act, not when a teammate does**: nothing pushes an edit
  to an open board, so a member meets a teammate's change on their next action or refresh and
  a notification is what tells them something needs them; a live subscription would hold a
  poll or a connection per open board against the preview's one shared daily request ceiling,
  while the write that actually costs a team — two people editing one card — is refused as
  stale.
- **Every member's own machine runs their own work**: a workspace registers each member's
  machine as a server and runs a decision on the machine of the member who took it — lifting
  0.8.0's one-server-per-board rule without adding dispatch between machines — so a decision
  waits for that member's machine rather than for whichever teammate's happens to be awake.

<!-- agent -->

## Today
- **#373 is what this group builds on**: the workspace and its one-transaction mutation
  (#314), the board stored in Cloud (#315), the app and CLI working against it (#316), the
  Local-or-Cloud onboarding (#317), and the browser surface (#322, #364). All of it answers
  one account.
- **The authorization check is in one place**: #314 puts every workspace endpoint behind an
  owner check deliberately kept in one predicate, so #376 swaps it for a membership check
  rather than reworking the control plane.
- **The revision check already refuses a stale write**: #312's `OpEnvelope` carries the
  revision the caller read and #314 refuses a write against an older one, so correctness for
  two writers is in place before any lease exists.
- **Sign-in, events and Slack are in place (#325)**: #326's machine-local session that the
  app and `akb` share, its admitted-account list, the event, action and outcome contract, and
  Slack as a connected app; #350 makes an approved request the whole of getting in.
- **#319 publishes to one account**: a ready card and a user-owned question go to the account
  whose local write produced it — the whole audience on a solo board, and the wrong one on a
  team.
- **The published pages say Cloud has no members and no roles**: `/cloud` lists "No members
  and no roles", and `/privacy` and `/terms` say the release has no shared board and no
  members, with `/terms` promising the page and its effective date change if sharing is added
  (#330, #349).
- **The `cloud` module's memory is current**: it already holds this program's settled
  decisions.
- **The board's own history lives in two files**: `record.csv` and `metrics.csv`, whose events
  predate any notion of a member.

## Scope
- **A workspace holds members, not one owner**: membership decides who may read a workspace
  and write to it, and every endpoint answers only that workspace's members.
- **Two roles and no third**: an owner manages members, roles, execution nodes and the
  workspace itself; a member performs every ordinary board operation. No per-card permissions.
- **A member is a signed-in GitHub account**: #326's machine-local session serves both the app
  and `akb`, and the group adds no second sign-in.
- **Every workspace stays private**: adding members opens a workspace to them and to nobody
  else, and admission to Cloud is not membership.
- **A non-member is told to ask an owner for an invite**: a teammate whose signed-in account
  is not a member of the workspace the pointer names is never told the board is missing.
- **One writer per card**: a card is held for the member writing it and says who holds it,
  with the revision check behind it as the refusal that actually protects the card.
- **One server per member's machine**: a workspace holds one for each member, and a decision
  taken away from a machine runs on the server of the member who took it, never on another
  member's.
- **Every mutation is attributed to a member**: whether it changes a card, a memory file or a
  release, and the workspace holds one audit trail the whole team reads.
- **Routing follows roles, never an assignee**: a user-owned question notifies the workspace's
  owners and a card ready for review notifies members watching the release, and no card
  carries an assignee.
- **Any member may answer a question they can see**: owner routing decides who is told, not
  who may write.
- **Solve the four problems in `goal.md`**: identify members, route a question to the person
  who can decide, allow one writer per card, and keep one attributed memory.
- **The board's existing history comes along**: `record.csv` and `metrics.csv` move into the
  workspace without inventing member attribution for events that predate the team.
- **Closing one member's account never deletes a workspace others are still in**: it removes
  their membership and their machines, keeps their name on the work they already did, and asks
  an owner to transfer or delete the workspace first.
- **The card that adds a capability rewrites the published pages**: whichever card adds a
  member or a role takes the matching paragraph off `/cloud`, `/privacy` and `/terms` in the
  same delivery — the "no shared board, no members and no roles" lists — and moves the legal
  pages' effective date, so all three describe what the group built before the first outside
  team is invited.
- **Recount the account ceiling once a team's writes are known**: `cloud/README.md`'s "How
  many accounts that carries" is recomputed when a shared board's own writes spend the same
  daily budget, so the number we invite up to is what a team costs. Counting is not enforcing.
- **Cloud never sees code and never runs a model over a board**: no repository, credential or
  model key reaches it on any card in this group, and every agent run stays on a member's own
  machine.
- **Out of the group**: the workspace, its store, the app and CLI against it, onboarding and
  the browser surface — all #373, and this group changes them rather than builds them.
- **Out of the group**: realtime body editing, fine-grained card permissions, dispatching work
  between members' machines, and any Cloud handling of code.
- **Out of the group**: GitHub Issues intake — #313 is an intake door into either board, and a
  team shares a board without it.
- **Out of the group**: pricing, billing, and the open-source support policy.
- **Out of the group**: the sign-in that carries a Cloud account and the admission list itself
  — #326 with #350 decides who reaches the service at all, and whether adding a member also
  admits that account is #376's call and the one place this group may write to that list.
- **Out of the group**: per-workspace usage caps and quota enforcement — the invite list and
  the service's own daily write budget (#323) are what bound cost and capacity in v1.
- **Out of the group**: naming a decider on a card — question routing follows the owner role,
  not a per-card assignee.

## Todo
- [ ] Add members and roles to a Cloud workspace #376
- [ ] Hold a card against a second writer #375
- [ ] Notify a workspace's owners and members about a card that needs them #328

## Source
- `docs/kanban/memory/goal.md`, the 团队协作 section — the four problems a shared board has to
  solve.
- #373 — the Cloud board and browser surface this group layers on.
