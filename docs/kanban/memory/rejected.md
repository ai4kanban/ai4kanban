# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Storage

- **Database-backed board** — the whole point is plain files in git that Claude and a
  human can both read and diff. A database hides the board and adds a dependency.

## Local UI

- **Mute cards you can't start yet** — the `ready` label on cards already shows what's ready
  to implement and, by absence, what you can't start yet, so a second "waiting" signal is redundant.
- **Open-questions notification center in the header** — no clear incentive to build it; open
  questions already show on the card. Worth revisiting later if the board grows a
  human-in-the-loop center.
