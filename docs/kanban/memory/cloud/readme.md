# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## What Cloud says about your data

- [/privacy](https://ai4kanban.dev/privacy) names every record the preview keeps for one
  signed-in account and what deletes each one, says it runs in Frankfurt and answers the
  account that owns a record, and says code, credentials and model keys never reach it and
  no model is run over board content. It names Resend and the `support@ai4kanban.dev`
  mailbox as subprocessors.
- [/terms](https://ai4kanban.dev/terms) says Cloud is a free invite-only preview with no
  availability promise, that we may end it or close an account at any time with reasonable
  notice where practical, and that what a closure costs is the event history — never the
  board, which was never on Cloud. Both pages leave the product description to
  [/cloud](https://ai4kanban.dev/cloud).
- What an account can remove for itself: disconnecting Slack, and nothing else. Signing out,
  turning Cloud off for a board and moving a board to another machine delete nothing;
  everything else is a request to `support@ai4kanban.dev` that takes the whole account with
  it. A person never admitted keeps their request and sign-in record until we delete them.

## Signing in and getting into the preview

- One GitHub sign-in makes a machine a Cloud account, from **Configuration →
  Notifications** in the app: every project the app opens and every terminal on that machine
  then acts as that account, with the session held in the user's home directory outside every
  repository. Signing out stops the machine reaching Cloud and changes nothing on the board.
  `akb cloud` says who a terminal is signed in as.
- The consent screen asks for `user:email` and cannot read a repository, so every account
  carries an address GitHub verified.
- A machine with no desktop app cannot reach Cloud: the consent screen comes back to the app
  over a URL scheme, and a terminal never starts a sign-in.
- An account we have not admitted signs in successfully, is named on screen, and is refused
  with one message naming the one way in — **Request an invite**, one click that types
  nothing and carries the GitHub handle and verified address. Pressing again records no
  second request; the pane shows the day it was asked.
- We answer by hand: approving admits the account there and then and emails the person, so
  the pane reaches the admitted state the next time it is opened, with no code to paste
  anywhere and no second sign-in. An approval-written admission is decided on the sign-in,
  so a GitHub rename never takes a place in the preview away:
  `cloud/README.md`, "Answer an invite request".
- The preview sends two emails and no others: the answer to a request, and the notice to
  `support@ai4kanban.dev` that somebody asked. There is no mailing list and no announcement.

## Events, and where a decision is made

- Turn notifications on for a board and pick one open release: a task that reaches `ready`,
  or that raises a question only you can answer, becomes a durable Cloud event. It carries
  the number, title, release and revision, the user-owned questions with their options, and
  the card's opening paragraph and review notes — bounded, and refreshed when the card is
  rewritten. The board is named by an id that means nothing outside Cloud. Cloud records the
  one decision made on it and how the run ended, then deletes the lot after 30 days.
- One event takes exactly one action, from whichever surface acts first; a second is refused
  and every other surface showing it redraws as answered.
- **Slack**: one destination per account, and every board you turn Cloud on for posts to it.
  A card is one message — it says where the card stands and carries every control, so a
  channel holds one entry per card — with one reply per event under it as the log. Pressing
  a control records the decision from wherever the message is read, with no app in front of
  you, and the board's machine runs it when next reachable. An unlinked, duplicate or stale
  press is refused in a line only that person sees.
- **Lark**: the same card and controls in a 飞书 or Lark international chat, one connection
  per account, beside Slack rather than instead of it — an account may have both, the first
  press settles the event, and the other message redraws as answered. A service operator
  registers the app first: `cloud/README.md`.
- Hints arrive over Realtime in seconds, on the desktop and on the board's machine alike, so
  the bell fills as events are raised rather than on a restart.

## A board kept in Cloud

- A Cloud **workspace** holds a whole board: its cards live and archived, the memory set, the
  goal, `config.md`, `modules.md`, `releases.md`, the per-flow rules, closed releases'
  summaries, the board's own history and its delivery records. What stays on the machine is
  what the board keeps out of git — API keys, the run record and its logs, chats, mockups, and
  `ui.config.json`, which is that machine's answer to which coding agent runs the board — so a
  second machine sees none of it.
- Nothing about the code goes with it: no repository, branch, worktree, commit, credential or
  model key. A delivery's repository half is stripped by the service itself, so a delivery's
  diff and the commit it landed as can be read only on the machine that ran it.
- `akb cloud import <workspace>` carries this board into a workspace, and changes nothing in
  it — the files are still the record. Run it again after an interruption and it carries on
  rather than writing a second copy of anything.
- `akb cloud export <workspace> --to <folder>` writes a workspace back out as a markdown
  board `akb --dir <folder>` opens as a Local one, reading the same. It is the only copy
  anyone can restore a Cloud board from: the preview keeps no backup of its own. Neither move
  is synchronization — neither keeps two writable boards in step.
- One writer holds a card, or the board, at a time, for half an hour and as often as they
  like. An expired hold is free for the next caller and nothing sweeps for it. A second
  machine writing a card the first has moved past is refused as a conflict naming the version
  the board holds now — never a silent overwrite.

## What Cloud says about a board's machine

- Cloud reports what the computer running a board's approvals resolves each of the board's
  runtimes to — the coding agent's name, and the model where one is set. The app lists them
  under the board's server row and `akb cloud` prints the same lines, so anyone can see from
  any machine what the board is running. Names only: no key, argument string or path leaves
  the machine.

## Running the preview

- `cloud/README.md`, "Limits the preview lives inside", derives from one account's flow how
  many accounts the free tier and the day's write budget carry, and what to read before
  inviting anybody past that.
