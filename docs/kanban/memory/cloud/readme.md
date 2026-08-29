# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## What Cloud says about your data

- Anyone weighing the Cloud preview can read what it does with their data before installing
  anything: [/privacy](https://ai4kanban.dev/privacy) names every record 0.8.0 keeps for one
  signed-in account — the sign-in record and the Cloud account row as two separate records, the
  admission, the invite request and the invitation, the board's Cloud id and the folder name it
  is registered under, the event with its decision, answers and outcome, the board's machine
  record, and the Slack connection — with what deletes each one against it, says it runs in
  Frankfurt and answers the one account that owns a record, and says code, credentials and model
  keys never reach it and no model is run over board content.
  [/terms](https://ai4kanban.dev/terms) says Cloud is a free invite-only preview with no
  availability promise, that we may end it or close an account at any time with reasonable
  notice where practical, that the notice is mail sent by hand from `support@ai4kanban.dev` to
  the address GitHub verified, and that what a closure costs is the event history — never the
  board, which was never on Cloud. Both pages leave the description of the product to
  [/cloud](https://ai4kanban.dev/cloud).
- **What an account can remove for itself, and what it cannot.** Disconnecting Slack is the
  only removal in the app; signing out, turning Cloud off for a board, and moving a board to
  another machine delete nothing. Everything else is a request to `support@ai4kanban.dev`, and
  that removal takes the whole account and everything under it — so asking for one board to be
  forgotten ends the account's place in the preview. A person who asked for an invite and was
  never admitted keeps their request, any code issued to them and their sign-in record until we
  delete them by hand. Both pages say so.

## Signing in to Cloud

- One GitHub sign-in makes a machine a Cloud account: **Configuration → Notifications** in the app
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
  so.** The privacy page describes the request and the invitation, names Resend and the
  `support@ai4kanban.dev` mailbox as subprocessors, and says both records are kept until we
  remove them by hand whether or not the account was admitted; both pages say the preview mails
  an account twice — the invitation loop, and a notice about the preview itself — and nothing
  else.

- **A board can send Cloud the tasks that need a person, and Cloud tells the app.** Turn
  notifications on for a board under **Configuration → Notifications** and pick one open release:
  a task that reaches `ready`, or that raises a question only you can answer, becomes a
  durable Cloud event. An event carries the task's number, title, release and revision and
  its user-owned questions with their options, and no other part of the card; the board is
  named by an id that means nothing outside Cloud, so where it sits on your machine never
  leaves it. Cloud records the one decision you make on it and how the run it started
  ended, and deletes the lot 30 days after that. [/privacy](https://ai4kanban.dev/privacy)
  says both.

- **A task waiting on a decision arrives in Slack, and the decision is made in the message.**
  Connect one Slack destination for your account under **Configuration → Notifications** and every
  board you turn Cloud on for posts to it, named on each message: the card's number and
  title, the opening paragraph and review notes it was published with, and **Implement** —
  or a question's own options — as buttons. Pressing one records the decision in Cloud from
  wherever the message is read, with no app and no machine in front of you, and the board's
  own machine runs it when that machine is next reachable. The message is rewritten in place
  as the work moves, under the same state names the bell shows, and it names the machine a
  decision is waiting for. A press by somebody we cannot link to an account, a second press
  on one event, or one against a card that has been rewritten since, is refused in a line
  only the person who pressed sees. Cloud now stores the card text a message is reviewed
  from, and [/privacy](https://ai4kanban.dev/privacy) says so.

- **Cloud now says what a board's server runs the board's work on.** The computer that runs a
  board's approvals reports what it resolves each of the board's runtimes to — the coding
  agent's name, and the model name where that computer set one. **Configuration → Notifications**
  lists them under the board's server row and `akb cloud` prints the same lines, so anyone can
  see from any machine what the board is actually running, and a rebinding shows up as soon as
  the pane is opened. It is names only — no key, no argument string and no path leaves the
  machine — and [/privacy](https://ai4kanban.dev/privacy) now describes that machine record in
  full: the machine id, the hostname, and the runtimes, kept while that computer runs the
  board's work.

- **A Cloud message now reaches the desktop and the board's machine in seconds again.** The
  rule guarding a board server's private Realtime topic asked a question the signed-in role
  could not answer, so joining either topic was refused — the bell filled only on a restart
  and an approval pressed elsewhere waited for the next five-minute check. Both topics now
  name the account, which is the one thing that rule can decide on its own, so hints arrive as
  they are raised. Apply the migration before the app that ships with it.
- **The preview's own ceiling is written down.** `cloud/README.md`, "Limits the preview lives
  inside", now derives from what one account's flow costs how many accounts the free tier and
  the day's write budget carry — about thirty to invite up to — and says what to read before
  inviting anybody past it.

- **The invitation email now describes the Cloud it invites you to.** It used to say Cloud
  holds your team's board, which this release does not do. It now says Cloud carries the
  moments the board needs you to your desktop and to Slack while your own machine does the
  work, and points at [/cloud](https://ai4kanban.dev/cloud) for the rest. The Worker has to be
  redeployed for the correction to reach anybody.

