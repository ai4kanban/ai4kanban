---
title: Build the Cloud control plane for team workspaces
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [312, 323]
related: [311]
modules: [cloud]
questions: []
---

Give each Cloud workspace one trusted place that decides who may change what and in what order.

## Scope
- Sign members in with GitHub and enforce owner and member access; every workspace is
  private, and nothing reads one without signing in.
- Allow only an invited GitHub account to create a workspace, and refuse the rest with a
  plain reason; owners still invite members into a workspace they already own.
- Allocate stable workspace, member, card, operation, delivery-attempt, and lease IDs.
- Register each machine that opens a workspace as a named execution node under the member
  who signed it in, and give it the node identity leases and delivery attempts are held by.
- Check membership, lifecycle rules, operation uniqueness, revision, and lease in one mutation.
- Append an attributed audit event and advance revisions in the same transaction.
- Allow one 120-second writer lease per card, renewed every 40 seconds and fenced by a rising token.
- Let owners revoke a lease; membership or node removal must invalidate later renewals and writes.
- Protect imports with a workspace maintenance lease and make multi-card changes all-or-nothing.
- Keep at least one owner in every workspace: refuse the role change or member removal that
  would leave none.
- Let an owner delete a workspace and everything in it, which is what #321's pages promise.
- Query the database on the Worker's schedule, so the free-tier project never pauses for
  inactivity while the preview is open.

## Todo
- [ ] Add GitHub login, private workspaces, membership, and roles.
- [ ] Gate workspace creation on the preview invite list, and check an uninvited account is
      refused with a reason.
- [ ] Add stable IDs, revisions, operation deduplication, and immutable audit events.
- [ ] Register, name, list, and remove execution nodes, and check a removed node's next
      renewal, write, and delivery confirmation are all refused.
- [ ] Add atomic writer lease acquisition, renewal, expiry, release, and revocation.
- [ ] Fence delayed writers after expiry or revocation.
- [ ] Add safe workspace maintenance and atomic multi-card operations.
- [ ] Refuse the last owner's demotion or removal, and say why.
- [ ] Add owner deletion of a workspace and everything stored in it.
- [ ] Check concurrent writers, stale revisions, retries, and membership removal.
- [ ] Keep the Supabase project active from the scheduled Worker run, and check a quiet
      week leaves the workspace reachable.

## Decided by the agent
- **Where public read-only access went**: to #322, with the browser surface that would render
  it. Nothing in this release reads a board outside a signed-in app, so a switch here would
  have no reader.
- **Where an execution node gets its identity**: here. #316 holds leases from a node, #317
  manages nodes, and #318 lets "the same node" confirm a pending delivery — all of which need
  a node the control plane issued and can revoke. A node registers itself the first time a
  machine opens the workspace, under the member signed in on it.
- **Why a workspace must always keep an owner**: #311 addresses a user-owned question to the
  owner role, so a workspace with no owner is a workspace whose questions reach nobody.
- **How an invite is handed out**: as a list of allowed GitHub logins the project maintains,
  checked at workspace creation. Sign-in is already GitHub, so this needs no code
  distribution and an entry can be removed again.
