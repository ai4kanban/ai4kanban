---
title: Say what the agent must be allowed to do before a button works
track: features
priority: med
roi: med
status: todo
blocked_by: []
related: [67]
modules: [local-ui]
questions:
  - "[user] Who unblocks the agent? (a) the user does it once in their own agent settings; the UI keeps passing nothing and only documents it. (b) the UI passes the flag itself on every run, the way #69 already decided for Codex, so a fresh install works on the first press. Recommend (b): the goal promises it works out of the box, and one harness unblocking itself while the other leaves it to the user is a split we would be explaining forever."
  - "[user] How much may the agent do? (a) only the board — write under docs/kanban/ and run the board script; Implement then still stops on its own edits. (b) everything in the repo, without asking. Recommend (b): Implement writes code anywhere, so a board-only allowance leaves the main button broken in exactly the quiet way this card is meant to end."
---

Tell the user what the coding agent needs permission to do, so a button that works on one
machine doesn't quietly do nothing on another.

## Today
- The UI passes no permission settings when it starts a run. Each run gets only what the
  user's own agent settings already allow.
- On the default settings the agent may read files, but not write them and not run
  commands. A run that has to write a card, or run the board script, stops the moment it
  tries.
- The run does not go red. It ends normally and lands in the runs panel as done. Its last
  message asks for an approval nobody will ever see, so the user gets a run that says it
  passed and changed nothing.
- Because it reads as a pass, background refining picks the same card again a minute later,
  and again after that.
- Shipping a permission file inside the repo does not fix this on its own. The agent
  ignores a project's allow-list until the user has trusted that folder once.

## Scope
- Say what the agent must be allowed to do: write files, and run commands. A setting that
  covers file edits alone is not enough — every card action runs the board script, and that
  is a command.
- Say how it gets allowed, in one place, with one recommended way.
- Put it where a user meets the UI first: the setup page for running it locally
  (`skill/references/local-ui.md`) and the UI's own README. `local-ui.md` promises today
  that there is nothing else to set up; that line stops being true.
- Stop counting a blocked run as a pass. A run the agent was not allowed to finish is a
  failed run, and it says on the run that a permission stopped it, not a crash. Once it
  counts as failed, #67's rule already stops the dispatcher re-picking that card.
- Naming every kind of failure is out of scope. This card adds one cause.

## What the user does
- Presses a button and the run does the work. When it can't, the run says so in plain words
  instead of passing quietly.

## Decided by the agent
- Does a blocked run count as a pass today? Yes, and that is the worst of the three
  outcomes — the agent exits normally, so nothing on screen says the work never happened.
  This card makes it a failure.
- How do we spot one? From the list of denied tools the run reports when it ends, not from
  the words in the agent's last message. Same rule as #67: match the signal, not the
  wording.
- Who names the failure on screen? #67 owns the failed-run display and this card only adds
  a cause to it. But a blocked run is not a failed run at all today, so turning it into one
  is this card's work.
- Does the dispatcher need a new waiting rule? No. #67 already stops picking a card whose
  runs keep failing, and that covers this once a blocked run counts as failed.
- Which file carries the paragraph? Both, for two different readers: `local-ui.md` for
  someone who installed the skill, `kanban-ui/README.md` for someone who came straight from
  npm. `local-ui.md` is setup only, so it names the user's own settings and links out for
  anything about how the UI starts the agent.
- Do the two main READMEs and the site copy change? No. Both quick starts already send the
  reader to the UI's README for options, and the site compares the skill's setup, not the
  UI's.

## Todo
- [ ] Write what the agent must be allowed to do, and how it gets allowed, in
      `skill/references/local-ui.md`, and fix its "nothing else to set up" line.
- [ ] Say the same in `kanban-ui/README.md`, next to how to start the UI.
- [ ] Stop a run the agent was not allowed to finish from counting as a pass — mark it
      failed.
- [ ] Say on that run, in plain words, that a permission stopped it.
- [ ] Take the permission away, press a button on a card, and check the run reads as a
      permission — not as a pass, not as a crash.
