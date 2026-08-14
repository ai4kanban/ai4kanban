# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## The board

- **Ready-only focus toggle** — hiding every card that isn't `ready` isn't useful; the
  board is small enough to scan, and a status is not worth hiding work over. The queue
  view, which shows ready and not-ready side by side, and the release dropdown, which
  hides a version the user picked, are both different ideas and both fine.
- **Mute cards you can't start yet** — the `ready` label already shows what can be started
  and, by absence, what can't, so a second "waiting" signal is redundant.
- **A Finished view that browses archived cards** — too little value for the work. An
  archived card is a plain file next to the board; anyone can read it in their editor.
- **Switching between projects from the browser UI** — a server serves the board it was
  started in, so a second board means a second server. This does not apply to the desktop
  app: an app with no terminal has to open and switch folders itself, and it ships there.
- **Open-questions notification center in the header** — no clear incentive to build it;
  open questions already show on the card. Worth revisiting if the board ever grows a
  human-in-the-loop center.
- **Ticking several cards to move them into a release at once** — cards go into and out of
  a release by asking the agent in plain words, not by hand-picking them in the UI. A
  multi-select bar builds the manual path we don't want.
- **Answering the board's open questions from your phone** — reaching the board from a
  phone is too big to carry as one card: the way in, who can reach it, and every screen a
  small display needs are each their own piece of work. The mobile board gets planned later
  as a group task.
- **Route every card read and write through the script** — listing cards and writing a
  card's frontmatter already go through it, and that covers what the board needs one owner
  for. A full read-and-write API on top changes nothing a user sees and slows down work
  that reads files today.

## Runs

- **Human-in-the-loop / mid-run reply to the agent** — no live reply channel. The agent
  raises open questions on the card and the user answers those; watching a run is a
  read-only tail of its log.
- **A follow-up prompt box on any finished run** — Resume covers the real need: a run that
  stopped short gets one "continue" turn, no typing. A prompt box on every finished run is
  the first step toward replicating a full chat inside the board, which is not what this
  UI is for. Worth reconsidering later, as a whole.
- **Per-card run history list** — the most recent run's log surviving a restart is enough;
  the global runs panel covers browsing. Older logs stay on disk for anyone who digs.
- **Telling the user what the agent must be allowed to do before a button works** — written
  from a guess. Nobody has reported a button that quietly does nothing because of
  permissions; raise it again from the actual case if it turns out to be real.

## Connectors

- **A Gemini CLI connector** — not one of the agents we want to reach. Cursor, OpenClaw and
  OpenCode come first, and any agent past them waits for users to ask.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — shipped in 0.6.0 and
  taken back out. It was a checkbox on the agent step that saved an `ownAgent` flag, and
  the flag's only effect was hiding the offer to finish setup. Its own line promised the
  board's buttons would stay quiet, and they didn't — every other button went on starting
  runs under the default agent. The board always has an agent to run, so "none of them" was
  never a state it could hold. The agent step ends on a passing test; the line to paste is
  what serves the user who works from their own agent.

- **A one-button in-UI setup run** — turned down once, then reversed in 0.6.0: the
  board offers **Finish setup** and runs the leftover steps itself. The reason it was turned
  down — the setup bar stays simple and just shows the line to copy — only held while a
  coding agent was the way in. The line to copy is still there, beside the offer.
