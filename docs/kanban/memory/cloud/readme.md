# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## What Cloud says about a team's data

- Anyone weighing the Cloud preview can read what it does with their board before installing
  anything: [/privacy](https://ai4kanban.dev/privacy) says what a workspace stores, that it
  runs in Frankfurt, that only its members can read it, that code, credentials and model keys
  never reach it, that no model is run over board content, and that deleting a workspace
  removes everything at once with no backup behind it. [/terms](https://ai4kanban.dev/terms)
  says Cloud is a free invite-only preview with no availability promise, that we may end it or
  close a workspace at any time with reasonable notice where practical, that notice arrives in
  the app or a connected Slack channel and never by email, and that an export is the only copy
  a team keeps.

## Signing in to Cloud

- One GitHub sign-in makes a machine a Cloud account: **Configuration → Cloud** in the app
  signs in through the user's own browser, and every project the app opens and every terminal
  on that machine then acts as that account — the session is held in the user's home
  directory, outside every repository. Signing out stops the machine reaching Cloud and
  changes nothing already on the board. `akb cloud` says who a terminal is signed in as.
- **Cloud is an invite-only preview, and says so to everyone else.** An account we have not
  admitted signs in successfully, is named on screen, and is refused with one message naming
  the two doors in: paste an invitation code, or ask us for one. It is a refusal of its own,
  never "sign in again", so nobody is sent round a loop that cannot end.
- A machine with no desktop app cannot reach Cloud in 0.8.0: the consent screen comes back to
  the app over a URL scheme, and a terminal never starts a sign-in of its own.

## Getting into the preview

- **A refused account has two doors, and finishes the job itself.** In **Configuration →
  Cloud** it can paste an invitation code, or press **Request an invite**. A code admits one
  account — whichever redeems it first — and admits it for good; the pane moves to the
  admitted state on the spot, with no second sign-in. A wrong code is told which of the three
  things went wrong: we don't know it, it has been used, or it was withdrawn.
- **Asking is one click and types nothing.** The request carries the GitHub handle and the
  email address GitHub verified, both read from the identity provider's own record. Pressing
  again records no second request and sends no second email; the pane shows the day it was
  asked instead of the button.
- **We answer by hand, and approving is one statement.** `select
  cloud.approve_invite_request('<handle>')` in the project's SQL editor issues the code and
  the next hourly run mails it — no admin screen, and no mail credential reaches whoever
  approves. `cloud.issue_invitation('<address>')` invites somebody who never asked,
  `cloud.withdraw_invitation` closes a code, and `cloud.remove_account` closes both doors and
  takes the request and the invitation with it. All of it is in `cloud/README.md`, "Answer an
  invite request".
- **The preview now sends email, and only this.** The code that answers a request, and the
  notice to `support@ai4kanban.dev` that somebody asked. Both go out from the Worker's hourly
  run through Resend, from `invites@ai4kanban.dev` replying to `support@ai4kanban.dev`,
  so a failed send is retried rather than lost. There is no mailing list and no announcement.
- **The sign-in now asks GitHub for `user:email`.** The consent screen names an email
  permission where it named none, so every account carries an address GitHub itself verified
  and nothing about a request has to be typed. It still cannot read a repository.
- **[/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) say
  so.** The privacy page describes the request and the invitation, names Resend as a third
  subprocessor, and says both records are kept as long as the account is admitted; the terms
  page no longer claims the preview sends no email at all, only that it sends none as a
  notice.

- **A board can send Cloud the tasks that need a person, and Cloud tells the app.** Turn
  notifications on for a board under **Configuration → Cloud** and pick one open release:
  a task that reaches `ready`, or that raises a question only you can answer, becomes a
  durable Cloud event. An event carries the task's number, title, release and revision and
  its user-owned questions with their options, and no other part of the card; the board is
  named by an id that means nothing outside Cloud, so where it sits on your machine never
  leaves it. Cloud records the one decision you make on it and how the run it started
  ended, and deletes the lot 30 days after that. [/privacy](https://ai4kanban.dev/privacy)
  says both.
