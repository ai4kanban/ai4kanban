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
  `support@ai4kanban.dev` as where to ask for an invite. It is a refusal of its own, never
  "sign in again", so nobody is sent round a loop that cannot end.
- A machine with no desktop app cannot reach Cloud in 0.8.0: the consent screen comes back to
  the app over a URL scheme, and a terminal never starts a sign-in of its own.
