---
title: Settle decisions.md from goal.md in setup, before the module map
track: skill
priority: high
roi: high
status: todo
release: next
blocked_by: []
related: [83]
modules: [skill, site]
questions: []
---

Give the decisions step of setup a real flow to follow. The agent reads `goal.md`, settles
every call it can from it into the project-wide `decisions.md`, and leaves each one it
can't as a question on the board. `references/setup.md` grows into the guide that holds
this, and the install prompt stops spelling it out.

## Today
- The step order is already right: the setup checklist runs config, goal, decisions,
  modules, tasks, so the decisions are settled before the module map is written.
- But the flow behind those steps only lives in the install prompt, one short line per
  step. `references/setup.md` covers the checklist file and the no-cards gate — not what
  the agent actually does at each step.
- So the decisions step is a single sentence with no rule behind it: nothing says what
  counts as a missing detail, and nothing says where the details it can't settle go.
- The install prompt still tells the agent to ask up to 3 questions. A setup that settles
  what it can and leaves the rest on the board doesn't need them.
- It also tells the agent to carry on when no goal comes back, which leaves a board whose
  decisions, map and first cards were all guessed from the seed text.
- Both READMEs describe setup as config, module map, first three tasks. The decisions step
  is missing from the story users read.

## Scope
- Grow `references/setup.md` into the guide for the agent's half of setup: what to do at
  each checklist step, in order. Both ways into setup land here — the install prompt, and
  the `/kanban` line the install command prints and the board's setup bar shows.
- Write the decisions step in full: read `goal.md`, work out the calls a planner would
  need — who it's for, what's out of scope, what done looks like — and settle every one the
  goal and common sense answer. One short line each in the project-wide `decisions.md`,
  grouped by topic. No cap on how many.
- Setup never stops to ask. Every detail it can't settle is kept and becomes a `[user]`
  open question on one of the cards setup creates in its last step. The user answers them
  afterwards through the board's normal resolve flow, in the UI or the harness, never
  during setup. No cap there either.
- The goal stays the user's to write. Setup does not draft it and does not tell the user
  what shape it must take.
- The goal is the one step setup cannot pass. With no goal written, setup stops there: no
  decisions, no module map, no first cards. Nothing after the goal can be built from the
  seed text. Setup says which step it stopped on and ends there.
- The board's setup bar keeps asking for the goal, as it does today, and a later setup run
  picks up from that step. A run that finds the goal already written ticks the goal box
  itself and carries on — the user may write the goal in the board's editor or in any text
  editor, and only the first ticks the box.
- Cut from the install prompt what the doc now holds: the per-step prose, and the line
  asking the user up to 3 questions. The prompt keeps the mechanical part — read the repo,
  run the install command — and points at the doc for the rest.
- The map itself is not written here. It comes last, in the closing step (#86) — which is
  why the decisions are settled first, so a repo with no code still has something to build
  a map from.

## What the user sees
- Setup runs start to finish without asking anything but the goal. It ends with a
  `decisions.md` that holds the first settled calls, a module map that matches them — even
  in an empty repo — and every question it couldn't answer waiting on the board.
- Skip the goal and setup stops there, with nothing half-built behind it. The bar on the
  board still asks for the goal, and setup goes on from that step whenever the user writes
  one.

## Decided by the agent
- Where do the unanswered questions live, when no card exists yet? On the cards setup
  creates in its last step. Setup keeps each gap as it goes and attaches it to the card it
  most affects. Nothing earlier can hold them — a question on no card is a question nobody
  sees.
- Does setup end by asking the user to confirm what it settled? No. Every call is a line
  in `decisions.md` they can read and overrule at any time; a review step at the end would
  be the interrogation this card removes.
- Does the doc sit alongside the install prompt's steps or replace them? Replace. Two
  copies of the same flow drift, and the prompt is the harder one to fix once a user has
  already pasted it.
- How does setup tell a written goal from an unwritten one? By the same test the board
  already uses: missing or still the seed text counts as unwritten, anything the user
  wrote passes (#108).
- Who ticks the goal box when the user writes the goal outside the board's editor? The
  next setup run. Only the editor's save ticks it, so a goal typed in a text editor would
  otherwise leave setup stuck on a step that is already done.

## Todo
- [ ] Grow `references/setup.md` into the agent's setup guide: one section per checklist
      step, in the order the checklist runs them.
- [ ] Write the decisions step in it: what to read in `goal.md`, what counts as a missing
      detail, and that the agent settles every one it can without asking.
- [ ] Write where the rest goes: each detail setup can't settle becomes a `[user]` open
      question on a card setup creates in its last step.
- [ ] Write the goal step in the doc: setup asks once, and stops there when no goal comes
      back — no decisions, no map, no cards built from the seed text. Say which step it
      stopped on before ending.
- [ ] Write how setup resumes: a later run that finds the goal written ticks the goal box
      itself and starts from the step after it.
- [ ] Point the install prompt at the doc, cut the step prose it now holds, and drop its
      "ask me at most 3 short questions" line and its line telling the agent to carry on
      when no goal comes.
- [ ] Point the setup checklist's own header at the doc, so an agent handed only the
      `/kanban` setup line finds the flow.
- [ ] Fix the setup line in both READMEs: it skips the decisions step and still promises
      three first tasks.
- [ ] Set up a fresh empty repo end to end and check setup asked for nothing but the goal,
      `decisions.md` holds real settled lines, `modules.md` was written after them, and the
      leftover questions sit on the board.
- [ ] Set up a repo with existing code and check the same order still holds.
- [ ] Run setup on an empty repo and write no goal: check it stops at the goal step with no
      decisions, no map and no cards, and the board's bar still asks for the goal. Then
      write the goal by hand and run setup again — it should carry on from the next step.
