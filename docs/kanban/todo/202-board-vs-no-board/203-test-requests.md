---
title: Write 20 test requests and say what a pass looks like
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [202]
modules: [skill]
questions: []
---

The test is only worth as much as its requests. Write the 20, and write what a right answer
looks like for each one before anybody runs anything.

## Scope
- Each request is one line a real user would type at a coding agent working in this repo.
- Each request comes with a pass condition in plain words — what the run has to do, or
  avoid doing, to count as right.
- Cover the mistakes the board is meant to prevent, a few requests each:
  - work already shipped — the run should say it exists, not build it again.
  - work already planned on a card — the run should point at that card.
  - an idea we turned down — the run should refuse and say why.
  - a question already settled — the run should follow the settled answer, not invent one.
  - a vague request — the run should ask instead of guessing.
  - work that depends on unfinished work — the run should notice what has to come first.
- A request only goes in if a reader can judge it from the run's output alone. Anything that
  needs a taste call gets dropped or rewritten.
- The list lives in one file in the repo, so anyone can read what we asked.

## Todo
- [ ] pick which mistakes the test covers, and how many requests go to each
- [ ] write the 20 requests
- [ ] write the pass condition for each one
- [ ] check every request against the repo as it stands, so the "right answer" really is
      right today
- [ ] save the list in the repo

## Decided by the agent
- **Which repo the requests are about** — this one. Its board is the richest one we have:
  shipped work, planned cards, turned-down ideas and settled calls all sit there already, so
  a request can be wrong in a way we can point at. #205 says out loud that the test ran on
  our own project.
- **How a request is worded** — the way a user actually types it ("add X", "can you build
  Y"), not as a question about the board. We are testing what an agent does with a request,
  not whether it can read a card when told to.
