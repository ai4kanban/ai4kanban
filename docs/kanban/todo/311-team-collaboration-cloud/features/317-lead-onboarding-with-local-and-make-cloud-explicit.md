---
title: Lead onboarding with Local and make Cloud an explicit choice
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [316]
related: [311]
modules: [local-ui, docs]
questions: []
---

Start a new user on a Local board, and make Cloud a choice they can find and take
deliberately.

## Worth noting
- **Why Local leads**: pricing and the open-source support policy do not exist yet, so a
  default install must not land on a service we pay to run (#311). Leading with Cloud is a
  later change, not a v1 one.
- **Cloud is an invite-only preview in v1**: the Cloud choice says so up front, and a
  signed-in user without an invite is told the preview is closed and how to ask, instead of
  meeting a failed workspace creation (#311).

## Scope
- Lead onboarding with Create Local board, with Open Local board beside it.
- Offer Create Cloud board and Open Cloud board as an explicit choice in the same
  onboarding, labelled as a hosted service and an invite-only preview, never preselected.
- Guide GitHub sign-in, workspace creation, opening, and Local-to-Cloud import for whoever
  takes the Cloud path.
- Let owners invite or remove members, change roles, manage execution nodes, and set public
  read-only access.
- Explain that Cloud manages board coordination but never receives code or runs agents.
- Update product and user documentation to describe the Local and Cloud authority models.

## Todo
- [ ] Make Local the path onboarding leads with.
- [ ] Offer Cloud beside it as an explicit, labelled choice, marked invite-only preview.
- [ ] Tell an uninvited signed-in user the preview is closed and how to ask for an invite.
- [ ] Add workspace, member, execution-node, and public-access controls.
- [ ] Offer Local-to-Cloud import when opening or creating a workspace.
- [ ] Explain the codebase boundary and both authority models in the app and docs.
- [ ] Check a new Local user, a new Cloud user, and an existing Local user can each finish
      onboarding.
