---
title: Start, watch, stop and resume an agent run from the CLI
track: skill
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: [192]
related: [160, 167]
modules: [skill, local-ui]
questions: []
---

Only the board UI can put an agent to work today — everything that runs one lives inside the UI server. Move it into the CLI, so a run can be started from the UI, from your coding agent, or from a terminal, and all three mean the same thing.

## Scope
- One command starts every kind of run the board has today: implement a card, refine it,
  resolve its questions, revise it, create cards, propose, plan a release, run a recurring
  card, archive, reject. It says which run it started.
- The same command follows a run's log, lists the runs, stops one, and continues one that
  failed — whoever started it.
- The words each run sends the agent come from one place, so a run started in a terminal
  and the same run started from a button do the same thing.
- A run uses the settings the board already saved — which agent, which model, how hard it
  thinks, who pays, and the key file — never whatever the terminal happens to export. The
  one-off check that the agent is set up right moves across too, since it runs the agent.
- The same command changes those settings: pick the agent, set its model, how hard it
  thinks and who pays, save a key, and turn auto-refine on or off with how many cards it
  refines at once. It also says which agents it can run and which settings each one takes,
  so a front end offers them without keeping its own list.
- The timer that starts work with nobody asking — the auto-refine pass and the recurring
  cadence — stays with the board process the user leaves open. The CLI does not sit in the
  background on its own. When the timer fires it starts a run the same way a person does,
  so a run nobody asked for is in the same list and under the same rules.
- A run outlives the command that started it. Close the terminal and the agent keeps
  working; the run is still there to watch and to stop.
- Both sides read one record of what is running, so a card being implemented from a
  terminal shows as busy in the UI, and the board's rules still hold across the two: one
  run per card at a time, one create at a time, and the runs that rewrite shared board
  files wait for each other.
- The bookkeeping travels with the run wherever it was started: the card says it is being
  worked on and gets its stage back at the end, a finished recurring card is stamped as
  run, and the log is kept so it can be reread.
- It works on a repo that has never installed the board UI.

## Decided by the agent
- **Does the command wait for the run to finish?**: no — it prints the run's id and
  returns, so the same run can be watched, stopped or continued from anywhere. A follow
  option waits and prints the log as it arrives, for someone who only wants to watch.
- **How is a run watched?**: from the log file the run writes, so any process can follow
  any run, including one it did not start.
- **What happens when the UI and a terminal both act on one card?**: neither wins by being
  the UI. Both go through the same record and the same rules — whoever asked first holds
  the card, and the other is told it is busy.
- **Where do the agent settings live now?**: the same file the UI already writes. Renaming
  it would break every board that has one, for nothing a user would notice.
- **Does the background timer move into the CLI?**: no. Deciding when to start work stays
  with the board process the user leaves open — a command that exits cannot hold a timer,
  and a loop inside a coding-agent session is not scheduling. The timer starts its runs
  through these same commands, so a background run is nothing special.
- **Does the CLI change the agent settings, or only read them?**: it changes them too —
  the agent, its model, how hard it thinks, who pays, the key, and the auto-refine switch.
  The settings travel with the running of the agent; leaving the writing behind would give
  one file two owners and keep the skill from asking for what the UI can do.

## Todo
- [ ] List every kind of run the UI can start today, and give each one a CLI command.
- [ ] Move the running of an agent into the CLI — starting, watching, listing, stopping and
      resuming — and the words each run sends the agent with it.
- [ ] Read the saved agent settings and keys from the CLI, the same way the UI reads them.
- [ ] Change those settings from the CLI too — the agent, its model, how hard it thinks,
      who pays, the key, and the auto-refine switch with how many at once — and have it say
      which agents it can run and which settings each one takes.
- [ ] Have the board's background timer start its runs through the same run commands, so a
      refine it starts and one a person starts are the same thing.
- [ ] Keep one record of the runs that every process reads and writes, so two of them never
      start the same work and both show the same list.
- [ ] Keep the bookkeeping with the run: mark the card busy, put its stage back at the end,
      stamp a finished recurring card, keep the log.
- [ ] Start a run from a terminal, watch it in the UI, stop it from the UI, and continue it
      from the terminal — then the same the other way round.
- [ ] Turn auto-refine on from a terminal, leave the board open, and check the refine it
      starts on its own shows in the terminal's run list and can be stopped there.
- [ ] Teach the run and settings commands in `README.md`, `README-zh.md` and
      `cli/README.md`.
