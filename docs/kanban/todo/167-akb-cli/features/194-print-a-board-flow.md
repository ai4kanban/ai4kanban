---
title: Let the CLI print a board flow instead of running it
track: features
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: []
related: [167]
modules: [skill]
questions: []
---

An agent already working in a session should not start a second agent to do the job it is
sitting there to do. Give every board action a second mode that prints what to do instead of
running it — written for this board, not as a page of general advice. And say plainly when to
reach for that mode, or an agent has to guess between printing and starting a run every time.

## When to use it
- Printing is the answer when a user asks a coding agent for a board action in a session. The
  agent asks for the flow and does the job itself, in the conversation it is already in.
- Starting a run is for work the user wants to happen on its own — in the background, while
  they do something else, on a card they are not watching. That is the explicit ask.
- An agent already working inside a run the board started never starts another run. Asking for
  an action there prints the flow, so a run cannot spawn a copy of itself.
- When it is not clear which the user meant, print. A printed flow costs nothing and can still
  be followed by starting a run; a started run costs a second agent, a second context, and
  money the user did not ask to spend.

## Scope
- Every action that can start a run can instead print the steps for whoever is asking.
- What it prints is filled in for the board it was asked about: this project's tracks, the
  memory file this card's modules point at, the card's remaining steps, the release it is
  in, the paths as they really are. A copied reference page has to describe all of that in
  general and hope the reader looks it up.
- It prints only what the job needs. Asking about one card does not print the whole manual.
- A printed flow ends by naming the command that closes the job, because nothing is watching
  that agent finish — the bookkeeping cannot happen on its own the way it does for a run the
  CLI started itself.
- When a job hands over to another action part-way, the flow names that action, so the agent
  does not fall back to guessing in the middle.
- The words are the same words a started run would send, so a job done this way and a job
  done by a button land the same result.
- The rule for choosing between the two modes sits where an agent reads it — beside each
  action in the command's own help — so the short note a project installs can point at it
  instead of carrying its own copy.
- Asking about a card that doesn't exist, or a board that isn't set up, says so plainly.

## Todo
- [ ] Give every action a mode that prints the steps instead of starting a run.
- [ ] Write the rule for choosing between printing and running into the command's own help,
      beside each action that can start a run.
- [ ] Print the flow, instead of starting a run, when the ask comes from an agent already
      inside a run the board started.
- [ ] Fill what it prints with the board it was asked about, not with general wording.
- [ ] Keep it to what the job needs, so a card's flow doesn't print the whole manual.
- [ ] End a printed flow by naming the command that closes the job, and name the next action
      when the job hands over to one.
- [ ] Keep the printed words and the run's words the same, so both land the same result.
- [ ] Ask an agent in a session to follow a printed flow for a create, a refine, a resolve
      and an archive, and check each leaves the board as the button would have.
- [ ] Ask an agent in a session for those same four actions without naming the mode, and
      check it prints rather than starting a run.

## Decided by the agent
- **When an agent prints rather than runs**: it prints whenever the user is asking it
  directly, and starts a run only when the user wants the work to happen on its own. In
  doubt, print — the wrong print wastes nothing, the wrong run bills for a second agent.
- **Who makes that choice**: the caller asks for the mode on the same command. The one
  automatic case is an agent already inside a run the board started. Guessing from the
  environment anywhere else would take away the background run a user deliberately asked for.
- **Work done from a printed flow leaves no run in the board's run list**: the list keeps to
  runs the board started, because those are the only ones it can follow or stop. The changed
  card is the record of the work.
