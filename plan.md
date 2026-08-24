# Team collaboration

Turn the team direction in `docs/kanban/memory/goal.md` into AI4Kanban Cloud. This document
records the product decisions and shipping order; it deliberately leaves coding and
infrastructure choices open.

## Product boundary

- **Local stays the default**: a local board remains Markdown in `docs/kanban/`, works offline,
  and needs no account.
- **Cloud is a different authority**: a Cloud workspace owns its cards, questions, memory,
  releases, history, members, and active claims. It is not a mirror of the Markdown board.
- **One authority at a time**: moving to Cloud is an explicit cutover. There is no background
  merge, CRDT, Git sync, or fallback to an old local snapshot.
- **Execution stays local**: Cloud never runs agents or stores model credentials. Each member's
  machine uses their repository, model account, worktrees, and local logs.
- **Machine-local state stays local**: credentials, processes, raw logs, chats, mockups,
  worktrees, and source code do not move with the board.

## Foundation before Cloud

Card #301's single board writer ships first. Agents must stop editing card and memory files
directly; every board action goes through AI4Kanban and behaves the same on local and Cloud
boards. Retries must not apply a change twice.

This expands #55 beyond swapping card storage. The board boundary must include every shared
artifact: cards, questions, memory, releases, history, and permanent run records.

Questions also need stable identities. A browser, agent, or Slack message must be able to answer
the same question even if its position on the card changes. Existing Markdown questions remain
valid and gain an identity when next changed.

The foundation is done when existing local workflows are unchanged, concurrent writes cannot
overwrite each other, retries are safe, and no agent flow depends on direct board-file edits.

## Workspace model

- **Workspace**: one team's complete board. Private by default; optionally public read-only.
- **Owner**: manages members, visibility, integrations, and releases.
- **Member**: reads and edits the board, answers questions, and runs cards.
- **Machine**: a member-approved CLI or desktop installation connected to a workspace.
- **Attribution**: every meaningful change records the member and, when relevant, the machine
  and run that performed it.

Members sign in with GitHub. Connecting a machine uses a browser approval flow initiated from the
CLI or desktop app. A member can rename or revoke a machine. Revocation takes effect on its next
Cloud interaction and never causes a fallback to local files.

A populated local repository must complete the move flow before connecting to a workspace. An
empty repository may connect directly to an existing Cloud workspace.

## Move and export

Moving a local board to Cloud is all-or-nothing:

1. Select an empty workspace.
2. Validate cards, references, memory, releases, history, and permanent run records.
3. Import the complete board without exposing a partial workspace.
4. Read it back and verify that it matches the local board.
5. Only then make Cloud authoritative.
6. Leave `docs/kanban/` untouched as a snapshot, but stop using it for normal board actions.

If any step fails, the local board remains authoritative. Repeating the move resumes or returns
the completed import rather than duplicating cards. Combining populated boards is out of scope.

Export writes a complete Markdown board, including attributed decisions and history, to an empty
destination. It does not overwrite an existing board or change the active authority.

## Decision inbox and memory

An open question is assigned to a member, claimed from the unassigned workspace queue, or left
unassigned. A workspace may name a default decision owner; an agent may explicitly choose
another member. V1 does not infer an owner from past decisions.

The inbox shows the card context needed to decide. A member may answer a question or edit
deterministic card fields without starting an agent.

Answering is one indivisible board change:

1. Confirm the question is still open and its card context is current.
2. Store the answer and answering member.
3. Remove the open question and recalculate card readiness.
4. Add an attributed decision to project memory or the card's first module memory.
5. Record the answer and memory change in workspace history.

If someone already answered, the second answer is rejected and the settled answer is shown. If
the card changed, the member reviews its current context before answering again. Later memory
cleanup may consolidate prose but cannot erase the attributed history.

The inbox ships with Cloud. A local-only phone inbox would require a second partial copy and a
sync protocol, adding most of Cloud's complexity without one authoritative board.

## Claims across machines

Starting a Cloud run first claims the card for one member, machine, and run. A second start is
refused and identifies the current claimant.

Claims are renewable leases. Normal completion releases the claim; a crashed or disconnected
machine stops renewing and the claim expires. Each new claim supersedes every older one, so an
old run cannot reconnect and write after another member takes over.

If a machine cannot renew, AI4Kanban stops the run and marks it interrupted. Its worktree and
logs remain local for recovery. Human edits remain allowed on claimed cards; a change to approved
requirements retires the run through #301's requirement check.

Claims prevent double work but do not dispatch it. Members choose cards and start them on their
own machines. Automatic dispatch requires separate concurrency and spend limits.

## External systems

### GitHub Issues

GitHub Issues is an intake and progress-mirroring integration, not a board backend. It works with
local and Cloud boards and ships before Cloud.

Import sends the issue's content and identity through #250's existing task-intake flow and
creates one proposed card with a traceable source. Reimport returns the same card. External
comments enter only as suggestions; they never overwrite board state.

Archiving, rejecting, or shipping a linked card may mirror progress outward. Failed deliveries
remain retryable, and retries cannot post the same update twice.

### Slack

Slack is a delivery channel for the Cloud inbox. It ships after browser answering works. An owner
connects the workspace and maps members to Slack users. Slack answers use the same board action
as browser answers and never create a second store. Stale or settled questions link back to their
current inbox state.

## Shipping order

1. **Single writer**: finish #301, add stable question identities, and move all board reads and
   writes behind AI4Kanban. Gate: concurrent and retried local actions are safe.
2. **GitHub Issues intake**: import once, preserve source, accept comments only as suggestions,
   and mirror progress outward. Gate: import and delivery retries do not duplicate anything.
3. **Cloud workspace and cutover**: add GitHub login, roles, machine approval, public read-only
   boards, move/export, and normal CLI/desktop board actions. Gate: a real board moves without
   loss, failed moves stay local, and exports work as local boards.
4. **Team inbox**: add browser editing, routing, attributed answers, shared memory, and complete
   history. Gate: stale edits cannot overwrite work and two answers produce one decision.
5. **Claims**: add claimant display, renewal, expiry, interruption, and takeover protection.
   Gate: two starts produce one run and an expired run can never write after recovery.
6. **Slack**: add member mapping, delivery, browser-equivalent answers, and retry. Gate: Slack and
   browser races settle once and attribution remains correct.

## Required failure behavior

| Situation | Required result |
| --- | --- |
| Cloud unavailable | Show an offline error; never read or write the local snapshot. |
| Move interrupted | Keep the local board authoritative until verification succeeds. |
| Two edits | Accept the first; make the second review the current card. |
| Two answers | Settle once; show the winning answer to the other member. |
| Two run starts | Grant one claim; identify the claimant to the other. |
| Machine disappears | Expire its claims and preserve local recovery material. |
| Old machine returns | Refuse writes from its superseded claims. |
| Member or machine revoked | Refuse its next request and interrupt its active run. |
| Slack or GitHub unavailable | Keep the board change and retry only the external delivery. |

## Out of the first team release

- Hosted agent execution or model credentials.
- Offline Cloud edits, merging, CRDTs, or bidirectional Git sync.
- Realtime document-style co-editing.
- Per-card or per-field permissions.
- Automatic assignee inference, dispatch, or execution scheduling.
- External comments directly changing board state.
- Combining populated boards or destructive import/export.

## Existing card changes

- **#55** becomes the complete shared-board boundary, not a card-file storage layer.
- **#59** is not a Cloud dependency; GitHub Projects remains optional future work.
- **#250** remains the common intake flow used by GitHub Issues.
- **#300/#301** precede Cloud; their writer, run identity, requirement check, and audit record are
  the discipline that team claims protect.
