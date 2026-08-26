---
title: Notify a workspace's owners and members about a card that needs them
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: [316]
related: [311]
modules: [cloud, local-ui]
schedule:
  action: refine
questions: []
---

Send a Cloud board's decision points to the teammates who can act on them. #319 publishes a
ready card and a user-owned question to the one account whose local write produced it — the
whole audience on a solo board, and the wrong one on a team, where the person who has to
answer is usually not the person whose agent asked. Without this, a shared board's questions
sit unseen until someone happens to open the card, which is the second of the four problems
#311 exists to solve.

<!-- agent -->

## Today
- #319 ships the event, action and outcome contract in 0.8.0, along with the desktop
  notification center that reads it and the per-member switch that turns notifications on for
  one open release. Every event it stores names one account: the publisher's.
- #320 delivers the same stored event to a workspace's connected Slack app.
- #311 settles the routing rule this card implements: a user-owned question goes to the
  workspace's owners, a card ready for review to the members watching its release, and no card
  names a person.
- #314 holds the membership and roles that make an audience resolvable, and #316 is what makes
  a team's writes reach a Cloud board at all.

## Scope
- Address a Cloud board's event to a workspace audience rather than to the account that
  published it: the owners for a user-owned question, the members watching its release for a
  card ready for review (#311).
- Resolve that audience from #314's membership at delivery time, so a member added or removed
  since the event was stored is included or dropped accordingly.
- Deliver one event to every member of its audience while the decision behind it stays single:
  the first answer settles the card, and every other recipient sees that outcome rather than a
  question still waiting.
- Attribute the answer to the member who gave it, through the audit trail every workspace
  mutation already writes (#314).
- Let any member answer a question they can see — owner routing decides who is told, not who
  may write (#311).
- Reuse #319's per-member notification switch and release choice rather than adding a second
  one: a member watching an event's release is one who turned notifications on for it.
- Stop delivering to a member the workspace removed, and stop delivering an event whose card
  or workspace is gone.
- Carry the same audience through every destination #325 built — the desktop notification
  center and a workspace's connected Slack — read from the one stored event rather than from
  what a connector remembers.
- Out of the card: naming a decider on a card, per-card permissions, and any browser
  destination (#322).

## Todo
- [ ] Give a Cloud board's event a workspace audience instead of one account, resolved from
      membership at delivery time.
- [ ] Route a user-owned question to the owners and a card ready for review to the members
      watching its release.
- [ ] Deliver one event to every member of its audience and show them all the same outcome
      once one of them answers.
- [ ] Attribute the answer to the member who gave it in the workspace audit trail.
- [ ] Stop delivery to a removed member, and for a deleted card or workspace.
- [ ] Check the same routing reaches the desktop notification center and a workspace's Slack.

## Source
- #311 — the routing rule, the owner role a question is addressed to, and the four problems
  this one closes.
- #319 — the event, action and outcome contract this card extends, and the notification
  center it is read in.
- #314 — workspace membership, roles, and the audit trail an answer is attributed through.
