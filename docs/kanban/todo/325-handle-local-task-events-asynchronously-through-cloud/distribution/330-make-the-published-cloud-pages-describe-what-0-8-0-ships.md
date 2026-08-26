---
title: Make the published Cloud pages describe what 0.8.0 ships
track: distribution
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [320]
related: [325]
modules: [site, cloud]
schedule:
  action: refine
questions: []
verify:
  - "The rewritten pages answer on the deployed site before the first invitation goes out: /privacy and /terms load from ai4kanban.dev, and support@ai4kanban.dev reaches a mailbox someone reads."
---

Rewrite the live privacy and terms pages to describe the Cloud 0.8.0 actually ships. Both
pages describe a team workspace that holds a shared board, with members, roles, an owner's
export and an owner's deletion — none of which exists in this release. What 0.8.0 stores is
one signed-in person's task events and the decisions they made on them, while the board and
the repository stay on their machine. The first invited person reads a published promise
about a product they were not given.

## Worth noting
- **The Cloud section is rewritten, not patched**: its whole shape promises a workspace, so
  fixing sentences one at a time would leave a page still built around members, roles and an
  owner's export. The cost is that #311 rewrites the same section again once a workspace
  exists; the option it beat was leaving the team wording in place as forward-looking, which
  publishes a false promise to every person the preview actually invites.
- **No workspace means no self-service deletion**: 0.8.0 gives an account no control that
  removes its Cloud history, so the pages say to ask at `support@ai4kanban.dev` and we do it
  by hand. The cost is a manual step per request; a delete button here would put a second
  privileged surface on a service whose only one today is its own Worker.

<!-- agent -->

## Today
- `web/legal/privacy.mdx` and `web/legal/terms.mdx` are live and linked from the site footer.
  Their Cloud sections describe a workspace holding a team's board — cards, memory, releases,
  history — read by its members, exported and deleted by an owner.
- 0.8.0 stores none of that. #319 stores an event snapshot, its connector deliveries, the
  human decision and its outcome; #318 stores an execution node and its delivery requests;
  #326 stores the account and its admission. The board and the repository never leave the
  machine.
- The privacy page describes a workspace's Slack as an incoming webhook an owner pastes.
  #320 connects a Slack app instead, so that paragraph describes a design nobody is building.
- The terms say that signing in to Cloud confirms you have read both pages, and #326's
  Configuration section is where a person signs in.
- #319 adds the Data retention line for finished event history, and #327 rewrites the line
  saying the preview sends no email and adds the invitation and its sender. Both ship before
  this card, and each amends the one fact it introduces.
- Deploying `web/` and routing `support@ai4kanban.dev` were hand-checks #321 left behind.

## Scope
- Describe Cloud as what 0.8.0 ships: a relay for one signed-in account's task events and the
  decisions made on them, never a shared board.
- Say what an event holds — the card's title, the question or review it raises, its release
  and revision, and the outcome — and repeat that no repository, worktree, commit, path,
  credential or model key reaches Cloud, and no model is run over board content.
- Replace the pasted-webhook paragraph with the Slack app #320 connects: the account connects
  and disconnects it, and a signed callback is how a decision comes back.
- Rewrite deletion and export for an account with no workspace: signing out stops the machine
  reaching Cloud, and `support@ai4kanban.dev` is where an account's record and history are
  removed.
- Address the terms' access, notice and end-of-preview clauses to a signed-in account rather
  than to a workspace's owners.
- Take workspaces, membership, roles and owner controls off both pages until #311 ships them.
- Keep the operator, the Frankfurt region, the subprocessor table, and the retention period
  and email lines #319 and #327 wrote, and check each still reads true after the rewrite.
- Say nothing the release does not ship.
- Out of the card: any new page, any change to the app, and the workspace wording #311 puts
  back when a team can share a board.

## Todo
- [ ] Rewrite the privacy page's Cloud section for an event relay: what an event holds, what
      Cloud never holds, and how long a finished one is kept.
- [ ] Replace the pasted-webhook paragraph with the Slack app #320 connects.
- [ ] Rewrite deletion and export for an account with no workspace.
- [ ] Take workspaces, membership, roles and owner controls off both pages.
- [ ] Address the terms' access, notice and end-of-preview clauses to an account.
- [ ] Check #319's Data retention line and #327's email amendment still read true, and move
      the effective date on both pages.
- [ ] Check both pages against #325's cards: every sentence about Cloud names something this
      release ships.

## Decided by the agent
- **Why this sits in #325 and not in #311**: #311 assigned the page correction to #328, which
  is in no release, while 0.8.0 invites the first outside person. The pages have to describe
  the preview that person is given.
- **Why #319 and #327 keep their own amendments**: each ships before this card and introduces
  one fact — a retention period, an email — so the page changes with the fact that made it
  wrong. This card is the sweep that makes the whole Cloud section true, and re-reads both.
- **Why it waits on #320**: the connected Slack app is the last thing these pages describe
  that is still being designed, so a rewrite before it could describe a shape that still moves.

## Source
- #321 — the two pages this card rewrites, and what they already commit to.
- #325 — what Cloud holds in 0.8.0: the event, action and outcome contract, and the board that
  stays local.
- #319 and #327 — the retention period and the email amendment this card re-reads.
- #311 — the team workspace both pages describe today, and the release that actually builds it.
- `web/legal/privacy.mdx` and `web/legal/terms.mdx` — the two files.
