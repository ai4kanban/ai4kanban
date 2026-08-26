---
title: Lead onboarding with Local and make Cloud an explicit choice
track: features
priority: high
roi: high
status: todo
release: ""
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
- Write the committed workspace pointer when a Cloud board is created or opened, so every
  teammate's clone reaches the same workspace (#311).
- After an import, say the folder's cards are now a stale copy and offer their removal as
  one change the team reviews and commits; never delete them on the team's behalf (#311).
- Let owners invite or remove members, change roles, and manage execution nodes.
- Let an owner export the workspace to a standalone markdown board at any time, and say
  there that the preview keeps no backups, so this is the team's only recoverable copy (#311).
- Offer leaving Cloud beside that export: write the board back into `docs/kanban/` and take
  the committed pointer off as one change the team reviews and commits (#311).
- Let an owner delete the workspace and everything in it from the same controls, behind a
  confirmation that names what goes, since #321's privacy page promises it (#311).
- Explain that Cloud manages board coordination but never receives code or runs agents, and
  link the Cloud choice to the published privacy and terms pages. #326 already says this and
  links them from the machine's Cloud sign-in; this card carries the same sentence and the
  same links onto the board choice, and extends it to what a workspace holds for a team.
- Update product and user documentation to describe the Local and Cloud authority models.

## Todo
- [ ] Make Local the path onboarding leads with.
- [ ] Offer Cloud beside it as an explicit, labelled choice, marked invite-only preview.
- [ ] Tell an uninvited signed-in user the preview is closed and how to ask for an invite.
- [ ] Add workspace, member, and execution-node controls.
- [ ] Offer the workspace export from the owner controls, and check what it writes opens as
      a Local board.
- [ ] Offer leaving Cloud, and check the checkout opens as a Local board once the team
      commits the removed pointer.
- [ ] Offer workspace deletion from the owner controls, behind a confirmation.
- [ ] Offer Local-to-Cloud import when opening or creating a workspace.
- [ ] After an import, offer the imported board's removal as a change the team commits, and
      check declining it leaves a working Cloud board.
- [ ] Bind a checkout to its workspace so a teammate's clone opens the same Cloud board.
- [ ] Explain the codebase boundary and both authority models in the app and docs.
- [ ] Link the Cloud choice to the published privacy and terms pages.
- [ ] Check a new Local user, a new Cloud user, and an existing Local user can each finish
      onboarding.

## Decided by the agent
- **Why there is no public-access control here**: a Cloud board is reached only from the
  installed app in this release, so making one public has nothing to read it. The switch
  ships with the browser surface in #322.
- **What 0.8.0 already did of this card's explaining**: #326 puts the Cloud boundary and the
  two page links above the machine's sign-in, because that release invites people and its
  Configuration section is the only place Cloud is offered. This card is not the first to say
  it, so it says the workspace half — what a team's board holds once Cloud is authoritative —
  and reuses the wording rather than writing a second one.
