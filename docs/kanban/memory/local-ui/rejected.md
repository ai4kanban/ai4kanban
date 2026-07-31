# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Goal

- **A fixed template for `goal.md`, shared by the script seed and the UI's starting text** —
  we don't pin down what the goal file must contain, the same way Claude Code and OpenClaw
  don't restrict what goes in `soul.md`. What we may write instead is a best-practices
  guide — a good goal covers the business goal, the long horizon, a roadmap, a direction —
  as advice, not a shape the UI or the agent enforces.

## Local UI

- **Human-in-the-loop / mid-run reply to the agent** — we don't add a live reply channel.
  The agent raises "open questions" on the card and the user answers those. Watching a run
  is a read-only tail of its log (that part lives on as its own task).
- **Per-card run history list** — the goal only needs the most recent run's log to survive
  a restart. A browsable list of past runs is more machinery than that goal justifies;
  older logs stay on disk for anyone who digs.
- **Ready-only focus toggle** — a board toggle to hide every card that isn't `ready` isn't
  useful; the board is small enough to scan, and hiding cards costs more than it saves. What
  was rejected is the hiding: a view that shows ready and not-ready side by side (#70) is a
  different idea and is fine.
- **A Finished view that browses archived cards** — too little value for the work. An
  archived card is a plain file next to the board; anyone can read it in their IDE or any
  file viewer. The UI does not have to be the place you review finished work.
- **A one-button in-UI setup run for a repo with no board** — the setup checklist (#85)
  is the onboarding UI. It starts simple: the bar shows the instruction to copy into your
  coding harness (e.g. `/kanban setup the current board`); the UI doesn't run setup itself.
- **A follow-up prompt box on any finished run** — the Resume button covers the real need:
  a run that stopped short gets one "continue" turn, no typing. A prompt box on every
  finished run is the first step toward replicating a full Claude Code chat inside the
  board, which is not what this UI is for. Worth reconsidering later, as a whole.
