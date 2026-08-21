# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## The board

- **Ready-only focus toggle** — hiding every card that isn't `ready` isn't useful; the
  board is small enough to scan. The queue view and the release dropdown are both different
  ideas and both fine.
- **Mute cards you can't start yet** — the `ready` label already shows what can be started
  and, by absence, what can't, so a second "waiting" signal is redundant.
- **A Finished view that browses archived cards** — too little value for the work. An
  archived card is a plain file next to the board; anyone can read it in their editor.
- **Switching between projects from the browser UI** — a server serves the board it was
  started in, so a second board means a second server. This does not apply to the desktop
  app, where it shipped.
- **Open-questions notification center in the header** — no clear incentive to build it;
  open questions already show on the card. Worth revisiting if the board ever grows a
  human-in-the-loop center.
- **Ticking several cards to move them into a release at once** — cards go into and out of
  a release by asking the agent in plain words. A multi-select bar builds the manual path
  we don't want.
- **Answering the board's open questions from your phone** — too big to carry as one card:
  the way in, who can reach it, and every screen a small display needs are each their own
  piece of work. The mobile board gets planned later as a group task.
- **Marking the cards that hold up other work** — a "holds up 3" badge beside the blocked
  padlock says less than the padlock does and competes with it for the same glance. A card's
  place in a chain of work is what a group task is for: the tree is drawn once, in the
  group, instead of being reassembled from a count on each card.
- **Route every card read and write through the script** — listing cards and writing a
  card's frontmatter already go through it, and that covers what the board needs one owner
  for. A full read-and-write API on top changes nothing a user sees and slows down work
  that reads files today.
- **A separate group for the UI work behind design questions** — the pieces are small enough
  to sit with the spec agents work that raises those questions in the first place. A group of
  its own would hold a card or two.
- **Rendering a drawing of a screen inside an open question** — we don't put a drawing in a
  question. A question lives in the card's frontmatter, which is no place for full detail, so
  there is nothing for the Resolve dialog to draw. The drawing stays in the card body, where
  the card page renders it.

## Runs

- **Human-in-the-loop / mid-run reply to the agent** — no live reply channel. The agent
  raises open questions on the card and the user answers those; watching a run is a
  read-only tail of its log.
- **A follow-up prompt box on any finished run** — Resume covers the real need: a run that
  stopped short gets one "continue" turn, no typing. A prompt box on every finished run is
  the first step toward replicating a full chat inside the board. Worth reconsidering
  later, as a whole.
- **Per-card run history list** — the most recent run's log surviving a restart is enough;
  the global runs panel covers browsing. Older logs stay on disk for anyone who digs.
- **Telling the user what the agent must be allowed to do before a button works** — written
  from a guess. Nobody has reported a button that quietly does nothing because of
  permissions; raise it again from the actual case if it turns out to be real.
- **A plain-words reason beside a failed run** — the only reason on offer was the tail of
  the agent's own output, which the log already shows; putting it on the run tells the user
  no more than they can read today.

## Connectors

- **A Gemini CLI connector** — not one of the agents we want to reach. Cursor and OpenCode
  come first, and any agent past them waits for users to ask.
- **A pi connector** — a user asked for it, and pi does show its log and pick up a stopped
  run. We still said no: pi never asks permission and nothing holds a run to the project,
  so picking it in the agent dialog would hand a run the whole machine. The other four
  agents stay in the repo, and no wording in the dialog makes that safe.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — a checkbox whose only
  effect was hiding the offer to finish setup, while every other button went on starting
  runs under the default agent. The board always has an agent to run, so "none of them" was
  never a state it could hold. The agent step ends on a passing test; the line to paste is
  what serves the user who works from their own agent.
