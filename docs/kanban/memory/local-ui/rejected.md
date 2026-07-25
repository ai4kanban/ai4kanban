# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Local UI

- **Human-in-the-loop / mid-run reply to the agent** — we don't add a live reply channel.
  The agent raises "open questions" on the card and the user answers those. Watching a run
  is a read-only tail of its log (that part lives on as its own task).
- **Per-card run history list** — the goal only needs the most recent run's log to survive
  a restart. A browsable list of past runs is more machinery than that goal justifies;
  older logs stay on disk for anyone who digs.
- **Ready-only focus toggle** — a board toggle to hide every card that isn't `ready` isn't
  useful; the board is small enough to scan, and hiding cards costs more than it saves.
