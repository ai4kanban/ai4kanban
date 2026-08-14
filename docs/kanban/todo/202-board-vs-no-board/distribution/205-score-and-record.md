---
title: Score the runs and keep the whole record in the repo
track: distribution
priority: med
roi: high
status: ready
release: 0.7.0
blocked_by: [204]
related: [202]
modules: [skill]
questions: []
---

A number nobody can check is just marketing. Score every run against the pass condition
written for it, and put the whole record in the repo so a reader can redo the scoring.

## Scope
- Every run gets pass or fail against its own pass condition, plus one line saying why.
- The record holds, per request: the request itself, both runs' full output, both verdicts,
  the date, and which agent and version ran it.
- A summary at the top: how many the board got right, how many it got wrong, and how many
  came out the same either way.
- Requests where the board lost, or made no difference, stay in and are counted. Dropping
  them would make the rest worthless.
- Say who did the scoring and how, so a reader can weigh it.
- Say plainly what the test does not show — 20 requests on one repo with one agent.

## Todo
- [ ] score each run against its pass condition, with a one-line reason
- [ ] write the summary counts: right, wrong, no difference
- [ ] keep every run's full output in the repo, next to its score
- [ ] write the short note on what the test does not show

## Decided by the agent
- **Who scores a run** — a fresh agent reads the run against its pass condition and writes
  the verdict and reason; a person checks a sample of them. The record says both, so a
  reader can weigh it and re-score from the transcripts.
- **What the note has to admit** — one repo, our own, one coding agent, 20 requests, run on
  one day. Anyone can find those limits; better that we name them first.
