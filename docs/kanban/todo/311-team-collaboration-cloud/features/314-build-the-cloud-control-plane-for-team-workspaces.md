---
title: Build the Cloud control plane for team workspaces
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [312, 313]
related: [311]
modules: [cloud]
questions: []
---

Give each Cloud workspace one trusted place that decides who may change what and in what order.

## Scope
- Sign members in with GitHub and enforce owner, member, and public read-only access.
- Allow only an invited GitHub account to create a workspace, and refuse the rest with a
  plain reason; owners still invite members into a workspace they already own.
- Allocate stable workspace, member, card, operation, delivery-attempt, and lease IDs.
- Check membership, lifecycle rules, operation uniqueness, revision, and lease in one mutation.
- Append an attributed audit event and advance revisions in the same transaction.
- Allow one 120-second writer lease per card, renewed every 40 seconds and fenced by a rising token.
- Let owners revoke a lease; membership or node removal must invalidate later renewals and writes.
- Protect imports with a workspace maintenance lease and make multi-card changes all-or-nothing.

## Todo
- [ ] Add GitHub login, private workspaces, membership, roles, and public read-only access.
- [ ] Gate workspace creation on the preview invite list, and check an uninvited account is
      refused with a reason.
- [ ] Add stable IDs, revisions, operation deduplication, and immutable audit events.
- [ ] Add atomic writer lease acquisition, renewal, expiry, release, and revocation.
- [ ] Fence delayed writers after expiry or revocation.
- [ ] Add safe workspace maintenance and atomic multi-card operations.
- [ ] Check concurrent writers, stale revisions, retries, and membership removal.

## Decided by the agent
- **How an invite is handed out**: as a list of allowed GitHub logins the project maintains,
  checked at workspace creation. Sign-in is already GitHub, so this needs no code
  distribution and an entry can be removed again.
