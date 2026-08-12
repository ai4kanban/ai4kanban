---
title: Let the CLI print a board flow instead of running it
track: features
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: [192, 168]
related: [167]
modules: [skill]
questions: []
---

An agent already working in a session should not start a second agent to do the job it is
sitting there to do. Give every board action a second mode that prints what to do instead of
running it — written for this board, not as a page of general advice.

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
- The words are the same words a started run would send, so a job done this way and a job
  done by a button land the same result.
- Asking about a card that doesn't exist, or a board that isn't set up, says so plainly.

## Todo
- [ ] Give every action a mode that prints the steps instead of starting a run.
- [ ] Fill what it prints with the board it was asked about, not with general wording.
- [ ] Keep it to what the job needs, so a card's flow doesn't print the whole manual.
- [ ] End a printed flow by naming the command that closes the job.
- [ ] Keep the printed words and the run's words the same, so both land the same result.
- [ ] Ask an agent in a session to follow a printed flow for a create, a refine, a resolve
      and an archive, and check each leaves the board as the button would have.
