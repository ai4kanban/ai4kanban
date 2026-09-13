# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## What Cloud says about your data

- Every record the preview keeps, where it runs, who owns it, and what deletes each one:
  [/privacy](https://ai4kanban.dev/privacy).
- Cloud is a free invite-only preview with no availability promise, and a closure costs the
  event history rather than the board: [/terms](https://ai4kanban.dev/terms). Both pages leave
  the product description to [/cloud](https://ai4kanban.dev/cloud).
- What an account can remove for itself is disconnecting Slack, and nothing else; everything
  else is a request to `support@ai4kanban.dev` that takes the whole account with it.

## Signing in and getting into the preview

- One GitHub sign-in makes a machine a Cloud account, from Configuration → Notifications:
  every project and terminal on that machine then acts as that account, and `akb cloud` says
  who. Signing out changes nothing on the board.
- The consent screen asks for `user:email` and cannot read a repository, so every account
  carries a verified address. A machine with no desktop app cannot sign in.
- An account we have not admitted signs in, is named on screen, and is refused with one
  message carrying **Request an invite** — one click that types nothing, recorded once.
- We answer by hand: approving admits the account there and then and emails the person, with
  no code to paste and no second sign-in, and it survives a GitHub rename:
  `cloud/README.md`, "Answer an invite request".
- The preview sends two emails and no others — the answer to a request, and the notice that
  somebody asked. There is no mailing list and no announcement.

## Events, and where a decision is made

- Turn notifications on for a board and pick one open release: a card that reaches `ready` or
  raises a question only you can answer becomes a durable Cloud event carrying enough of the
  card to review it, refreshed when the card is rewritten and deleted 30 days after it ends.
- One event takes exactly one action, from whichever surface acts first; a second is refused
  and every other surface redraws as answered.
- **Slack** posts one message per card with every control on it and one reply per event under
  it, so a control can be pressed from anywhere and the board's machine runs it when next
  reachable. One destination per account.
- **Lark** is the same card and controls in a 飞书 or Lark chat, beside Slack rather than
  instead of it; a service operator registers the app first: `cloud/README.md`.
- Hints arrive over Realtime in seconds, so the bell fills as events are raised.

## A board kept in Cloud

- What a workspace holds, what stays on the machine, and what moving either way costs:
  `web/content/docs/local-and-cloud-boards.mdx`.
- Nothing about the code goes with it: no repository, branch, worktree, commit, credential or
  model key, and a delivery's diff can be read only on the machine that ran it.
- `akb cloud import <workspace>` carries this board in and changes nothing in it, resuming
  after an interruption rather than doubling anything. `akb cloud export <workspace> --to
  <folder>` writes one back out as a Local board, and is the only copy anyone can restore
  from — the preview keeps no backup. Neither is synchronization.
- One writer holds a card, or the board, at a time on a half-hour lease. A second machine
  writing a card the first has moved past is refused as a conflict naming the version the
  board holds now — never a silent overwrite.

## A Cloud board in a browser

- A workspace has a URL its members open — `cloud.ai4kanban.dev/<workspace-id>`, and
  `/<workspace-id>/<card-id>` for one card — signed in independently of the machine, reading
  and never writing: `web/content/docs/local-and-cloud-boards.mdx`.
- No Cloud board is on the open web: a signed-out visitor, an account it is not for, a deleted
  workspace and a made-up id all meet the same sentence, every page is `noindex`, and a pasted
  link previews nothing.
- Every signed-in hosted page carries the account in the top row, phone width included, and
  `cloud.ai4kanban.dev/settings` says board and machine settings are the app's.

## What Cloud says about a board's machine

- Cloud reports what the board's machine resolves each runtime to — the coding agent's name
  and the model where one is set — so anyone can see from anywhere what the board is running.
  Names only: no key, argument string or path leaves the machine.

## Running the preview

- How many accounts the free tier and the day's write budget carry, and what to read before
  inviting anybody past that: `cloud/README.md`, "Limits the preview lives inside".

## What Cloud holds that is not a board

- Cloud takes the bookings behind [/training](https://ai4kanban.dev/training): a visitor with
  no account holds an hour, the link in the confirmation is the only way to read or cancel it,
  and reading the records needs an admitted account named an operator.
