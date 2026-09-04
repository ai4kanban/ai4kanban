---
title: Test whether the board changes what a coding agent builds
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [203, 204, 205, 206]
modules: [skill, site]
questions:
  - question: "[user] Do we write and run all 20 requests up front, or run 5 first and decide from those?"
    mode: single
    options:
      - run 5 first — cheaper, and we find out early whether the difference is readable
      - write and run all 20 up front — one pass, and the result is publishable sooner
    recommend: [1]
---

We tell people the board makes a coding agent build the right thing. Nothing backs that up.
Give the same requests to Claude Code twice — once with the board, once without — and
publish what each run came back with. This is a group task; each piece is its own subtask
in this folder.

## Today
- The only evidence for the board is our own words, on the site and in the README.
- Someone deciding whether to use this has nothing to look at.

## Scope
- 20 requests, each one a thing a real user would ask a coding agent working in this repo.
- Every request runs twice from the same repo state: one run with the board and its memory,
  one run with neither.
- Example: ask for a feature the board has already planned and shipped — walking a
  first-time user through setup in the UI. The run with the board should find that work
  already done and not write the feature a second time; the run without it should start
  building. When that is what happens, the board did something a user can see.
- For each request we say what a pass looks like **before** anyone runs it.
- The whole record lives in the repo: every run's output, its verdict, and the count.
  Anyone can check our numbers instead of trusting them.
- The result goes on the site and in the README, whatever it says.
- Out of this group: testing a coding agent other than Claude Code, and comparing the board
  against other project tools.

## Todo
- [ ] Write 20 test requests and say what a pass looks like #203
- [ ] Run each test request twice — once with the board, once without #204
- [ ] Score the runs and keep the whole record in the repo #205
- [ ] Show the result on the site and in the README #206

## Decided by the agent
- **Which agent we test** — Claude Code only. It is the one we support best today, and one
  agent tested properly says more than three tested loosely.
- **What "without the board" means** — the same repo with the cards, the memory and the
  skill taken away. Not a different repo, so the only thing that changed is the board.

## Pushback
- This is expensive: 40 agent runs plus the reading. Write and run 5 requests first, look at
  what comes back, and only write the other 15 if the difference is real and readable.
- The result may not favour us. We publish it either way — a test we only publish when we
  win is worth nothing.
