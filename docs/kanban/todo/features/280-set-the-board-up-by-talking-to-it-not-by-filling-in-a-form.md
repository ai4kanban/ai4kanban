---
title: Set the board up by talking to it, not by filling in a form
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [229, 266]
modules: [local-ui, skill]
questions:
  - question: "[user] Nothing is configured yet on a first run, so what does the setup conversation itself run on?"
    mode: single
    options:
      - Find an agent CLI already on the machine and use it; ask for a harness only when none is found
      - Ask for the harness and its login first, on one screen, then start talking
      - Ship a model the board pays for, used for onboarding only, so it works with nothing installed
    recommend: [1]
  - question: "[user] Does the conversation replace the setup form, or sit in front of it?"
    mode: single
    options:
      - "Replace it — the form stays one click away behind \"I'll fill it in myself\""
      - Sit in front of it — the conversation fills the fields and the user reviews the same three screens
      - Offer both on the first screen and let the user pick
    recommend: [1]
  - question: "[user] How much may the conversation settle on its own before it asks anything?"
    mode: single
    options:
      - Everything it can read off the repo — name, what it is, tracks, modules — shown back as one summary to confirm; only the goal is asked for
      - One short question at a time, confirming each thing as it goes
      - Ask nothing — write a full draft board and let the user correct it afterwards
    recommend: [1]
  - question: "[user] Where does the conversation live — the chat the board already has, or a first-run screen of its own?"
    mode: single
    options:
      - A first-run screen of its own, full window, so setup never looks like an ordinary chat
      - The chat rail, opened wide, so there is one place you talk to the board
    recommend: [1]
---

The first thing a new user meets is a three-screen form: type the project name, type what
it is, name the tracks, write the goal, pick the agent. The product's whole promise is that
you hand it something vague and it works the rest out — and the first run does the opposite.
Open a project with no board and have it talk to you instead: it reads the repo, says what
it thinks the project is, asks for the one or two things it can't know, and the board exists.

## Scope
- **Where it starts**: opening a folder with no board opens a conversation, not the form.
- **It reads first, asks second**: before its first sentence the agent reads the repo —
  README, package files, folder shape, recent commits — and comes back with a filled draft:
  the name, what the project is, its tracks, its modules, and a first stab at the goal.
- **Two turns, not six fields**: "here's what I think this project is — right?" → the user
  corrects it in a sentence or says yes → the board is written. Everything the agent is sure
  of is stated, not asked.
- **The goal is still the user's**: it is the one thing no repo can tell you. Ask for it in
  words, from a draft the user edits or throws away, not from an empty box.
- **The harness comes first**: nothing can be said until there is an agent to say it. Before
  the conversation, find the agent CLIs installed on this machine, use one that works, and
  get past login. Nothing installed, or nothing logged in, drops the user on today's form.
- **A way out on every turn**: "I'll fill it in myself" goes to the screens that exist today.
  Nobody is trapped in a chat.
- **It has to look like work, not a hang**: while the agent reads the repo and writes files,
  say what it is doing — a first run that shows a blinking cursor for forty seconds reads as
  broken.
- **It ends where setup ends today**: `config.md`, `goal.md`, `decisions.md`, the checklist
  ticked step by step, and the steps that need a run handed to an ordinary run in the panel.
  The user can read back what was assumed on their behalf.
- **The words follow**: `cli/src/guide/setup.md` and `akb setup` describe a form-driven first
  run; both have to say what actually happens now. Same for the guides and the READMEs.

Not necessarily openclaw's shape — that is the reference, not the spec. Worth weighing
against: a single "tell me about your project" box that produces the whole board in one go,
and a first run that writes a complete draft board and asks nothing until the user is
looking at it.

## Todo
- [ ] Write the first run turn by turn — what it says, what it asks, what it never asks.
- [ ] Settle the four open questions.
- [ ] Draw the screen: the conversation, its progress while it works, its errors, and the
      way back to the form. Read `akb guide ui-design`.
- [ ] Work out the harness bootstrap: which CLIs to look for, how to know one is logged in,
      and what the user sees when none is.
- [ ] Have the agent read a repo and produce a full draft setup — name, description, tracks,
      modules, draft goal — with a confidence it is willing to state.
- [ ] Build the conversation and have it write `config.md`, `goal.md` and `decisions.md`,
      ticking each checklist box as it goes.
- [ ] Keep the existing form reachable from every turn, and as the fallback when there is no
      agent to talk to.
- [ ] Hand the remaining checklist steps to an ordinary run when the conversation ends.
- [ ] Update `cli/src/guide/setup.md`, the guides, `README.md` and `README-zh.md`.
- [ ] Try it on an empty folder, on a repo with a lot of existing code, and on a machine with
      no agent installed at all.

## Source
- Feedback from a user, relayed in chat on 2026-08-21 — "涛哥目前 AI4Kanban 的新手体验我感觉
  有点太 old school 了。起手能不能整个小 agent，类似 openclaw onboard 那种聊两句就自动
  setup 好", followed by "not necessarily the openclaw onboard way. brainstorm it". The
  observation: today's first run is a form the user fills in by hand, so a new user's first
  impression is data entry rather than the agent that is supposed to do the thinking.
  `docs/kanban/memory/goal.md` already carries this as an unshipped item — "Onboarding：首次
  使用时应该经过类似于 typeless 的引导，完成看板的初始化，包括设置 goal.md" — with no card
  behind it.
