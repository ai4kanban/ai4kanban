---
title: Handle a failed agent run instead of just marking it red
track: features
priority: high
roi: high
status: ready
release: 0.6.1
blocked_by: []
related: [16, 51]
modules: [local-ui]
questions: []
---

Say why an agent run failed, and don't let a usage limit quietly swallow the work the
board was about to do.

Today every failure looks the same: the board marks a run failed when the exit code isn't
0, and that is all anyone learns. A run that hit the plan's usage limit, a run that
crashed, and a run where `claude` isn't installed can't be told apart.

The cost is more than a poor message. Work the board starts on its own is started once and
never again: a scheduled card loses its mark the moment its run starts, a recurring card is
passed over once a run exists for the window it is due in, and a refine that follows a run
is never started twice. A usage limit kills any of these in seconds and the work is lost
with it — the scheduled card reads plain again, the daily job simply doesn't run, and
nothing on screen says why.

## Scope

**Name the reason**
- Read the reason out of the run's own output instead of guessing it from the exit code.
- Sort a failed run into one of three kinds:
  - **rate limit** — the plan's usage limit, or the service turning requests away.
  - **can't start** — the agent command isn't installed, or the user isn't logged in.
  - **everything else** — the fallback kind.
- The three kinds are the same for every harness, but each harness recognises its own.
- For Claude Code the signal is structured, not words: a rate-limited run ends with an HTTP
  429 and reports the reset time and which limit was hit — the 5-hour session limit or the
  weekly one.
- The reset time arrives partway through the run, not at the end, so catch it as the run
  goes.
- A healthy run reports the same reset time to say the limit is fine, so count only a run
  the limit turned away. Miss this and every good run pauses the board.
- Codex needs no rate-limit signal: it retries inside its own CLI, so a limit never reaches
  the board as a failed run.
- Show the kind on the failed run, in plain words next to its log.
- Say on that same run when the board will try again.

**Make the board wait**
- After a rate-limited run, the board starts nothing of its own until the reset time that
  run reported. With no reset time, wait 30 minutes. Cap the wait at 6 hours either way.
- After a "can't start" run, wait 5 minutes. Each new one restarts the 5 minutes.
- The wait is per harness. A Claude limit must not keep the board quiet after the user
  switches to Codex.
- A wait never blocks a person. Every button stays live, and pressing one is how you find
  out whether the limit lifted.
- The first run that gets through ends the wait, whoever started it.

**Start again what the limit killed**
- Record who started each run: the board on its own, or a person.
- When a wait ends, start again every run of the board's own that a rate limit or a "can't
  start" killed — the scheduled card that lost its mark, the recurring pass that was
  skipped, the refine that was following a run.
- Start one only if it would still do something. A card someone has since taken to `ready`
  needs no refine, and a card already in a live run is left alone.
- One restart per card, from the newest run a limit killed on it.
- A run a person started is never restarted. The button they pressed is still there.

**Remember it across a restart**
- Read the wait and the runs to start again off `docs/kanban/.sessions.json` — the record
  the board already keeps across a restart and already keeps out of git.
- Add no state file of this card's own.

## Scope out
- No per-card "give up after N failed runs" count, and no board chip or notice bar for one.
- No global paused indicator anywhere in the header. The failed run in the runs panel is
  where the reason and the wait are named.
- No control to end a wait early. Starting any run yourself already does it.
- No line about a stopped-short run on the card's own page — that is #179's, and it shows
  whatever this card writes onto the run.

## Already true
- The server runs `claude` with `CLAUDE_CODE_MAX_RETRIES=0`, so a failure ends the run at
  once rather than backing off inside the CLI for an hour.
- Nothing repeats a run on a card by itself: nothing hunts the backlog for refines, a
  refine never follows a refine, a scheduled card loses its mark as it fires, and a
  recurring card is passed over once a run exists for its window.

## Decided by the agent
- Where does the reason live? On the run's record, beside its pass/fail result — the same
  record the board already polls.
- How do we spot a rate limit? From the 429 and the reset number the run emits, not the
  words in the message. The wording changes between versions and differs per harness; the
  number does not.
- Does Codex need its own rate-limit signal? No. It retries inside its own CLI until it
  gets through, so a limit never reaches the board as a failed run.
- Is the old "stop picking a card after 3 failed runs in a row" rule still needed? No, and
  it is cut. It guarded a loop the board can no longer have: the auto-refine sweep that
  walked the backlog is gone, and every remaining way the board starts work fires once. The
  per-card count, its state file, the shared notice bar and the board chip all went with
  it.
- What is the harm now, if not a loop? A limit no longer repeats work — it loses it. So
  this card gives the lost work back instead of counting failures.
- Does the wait need a file of its own? No. The run record already holds every failure with
  its time and its harness. A wait whose run ages out of the 30 runs the record keeps costs
  one wasted run, which starts the wait again.
- Why per harness rather than per board? A limit belongs to one account under one agent,
  and switching agents is the other way to carry on working.
- Who owns the give-up rule now? #16 (auto-implement), if it ships. It is the one thing
  that would pick the same card again, so the rule is its own to write.

## Todo
- [ ] Read the failure reason out of the finished run instead of guessing it from the exit
      code, and sort it into rate limit / can't start / everything else. Each harness
      recognises its own signal.
- [ ] Keep the reset time and which limit was hit — caught while the run goes, and only
      from a run the limit actually turned away.
- [ ] Show the kind on the failed run in the UI, in plain words, and say when the board
      will try again.
- [ ] Record who started each run, so the board's own runs can be told from a person's.
- [ ] Make the board wait after a rate limit before it starts anything of its own — until
      the reported reset time, capped at 6 hours, or 30 minutes when the run reports none.
      Keep the wait per harness.
- [ ] Make it wait 5 minutes after a "can't start" run, with each new one restarting the 5
      minutes.
- [ ] End the wait on the first run that gets through, and leave every button live while a
      wait is on.
- [ ] Start again, once the wait ends, each run of the board's own that a limit killed —
      one per card, only where it would still do something, never one a person started.
- [ ] Add a "when a run fails" section to `kanban-ui/README.md`: the three kinds, what the
      board does about each, and that a limit no longer loses a scheduled or recurring pass.
- [ ] Fix the four passages in `kanban-ui/README.md` this card makes wrong — "the reason is
      in its output", the `CLAUDE_CODE_MAX_RETRIES` paragraph, the scheduled "it fires once"
      line, and the recurring "the board leaves that card alone" line.
