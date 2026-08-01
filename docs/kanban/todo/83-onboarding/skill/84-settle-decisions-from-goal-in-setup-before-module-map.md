---
title: Settle decisions.md from goal.md in setup, before the module map
track: skill
priority: high
roi: high
status: ready
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
  is missing from the story users read, and the count is stale — setup ends with ten first
  cards.
- The landing page's install section says the same thing, in all five languages: the agent
  fills in the configuration and proposes your first three tasks.

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
- A leftover call that fits none of those cards — who it's for, what's out of scope — gets
  a card of its own. Setup adds one card that carries them all as `[user]` questions, so
  nothing it couldn't settle is dropped. It sits on top of the ten, and setup only writes
  it when something is left over.
- The goal is the only thing setup asks for, timing included. A deadline belongs in
  `goal.md` as part of the horizon (#87 splits the decisions from it), so no step asks for
  one. A goal that says nothing about time means there is no deadline.
- The goal stays the user's to write. Setup does not draft it and does not tell the user
  what shape it must take.
- The goal is the one step setup cannot pass. With no goal written, setup stops there: no
  decisions, no module map, no first cards. Nothing after the goal can be built from the
  seed text. Setup says which step it stopped on and ends there.
- The board's setup bar keeps asking for the goal, as it does today, and a later setup run
  picks up from that step. A run that finds the goal already written ticks the goal box
  itself and carries on — the user may write the goal in the board's editor or in any text
  editor, and only the first ticks the box.
- The doc ends by recommending the local board UI in one line: the command to run it and
  where to read more. Setup prints it and stops — it never waits for an answer.
- Cut from the install prompt what the doc now holds: the per-step prose, the line asking
  the user up to 3 questions, and the local-UI offer that waits for a yes. The prompt keeps
  the mechanical part — read the repo, run the install command — and points at the doc for
  the rest.
- The doc's module-map step keeps the slot the checklist gives it today. #86 is what moves
  the map to the closing step; this card only puts the decisions in front of it, so a repo
  with no code still has something to build a map from.
- The doc's last step creates ten first cards, the number already settled for setup. Three
  is what today's prompt says, and what both READMEs and the landing page promise.

## What the user sees
- Setup runs start to finish without asking anything but the goal. It ends with a
  `decisions.md` that holds the first settled calls, a module map that matches them — even
  in an empty repo — and every question it couldn't answer waiting on the board.
- Skip the goal and setup stops there, with nothing half-built behind it. The bar on the
  board still asks for the goal, and setup goes on from that step whenever the user writes
  one.
- When setup ends it says in one line how to open the board in the local UI, then stops.
  Nobody has to answer it to be done.

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
- Is the deadline (#87) an exception setup asks in line? No. The deadline is part of the
  horizon and lives in `goal.md`, which #87 already settled, so setup reads it there like
  everything else. A goal that says nothing about time means no deadline, and nothing is
  asked or raised.
- Does the local-UI offer stay in the install prompt? No. It moves into the doc as a
  closing recommendation nobody waits on. A user who reaches setup from the `/kanban` line
  never sees the prompt, and an offer that waits for a yes is the asking this card removes.
- Where does a leftover call go when none of the first cards fits it? On one extra card
  setup adds for exactly that, each call a `[user]` question. The broad calls are the ones
  that fit no feature card, and a question on no card is a question nobody sees.
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
- [ ] Write what happens to a leftover call no first card fits: setup adds one more card
      that carries those calls as `[user]` questions.
- [ ] Say in the doc's goal step that timing belongs in the goal — setup reads any deadline
      from `goal.md` and asks for nothing but the goal itself.
- [ ] Give the doc a closing line that recommends the local board UI: the one command to
      run it and where to read more, printed without waiting for an answer.
- [ ] Write the goal step in the doc: setup asks once, and stops there when no goal comes
      back — no decisions, no map, no cards built from the seed text. Say which step it
      stopped on before ending.
- [ ] Write how setup resumes: a later run that finds the goal written ticks the goal box
      itself and starts from the step after it.
- [ ] Point the install prompt at the doc and cut everything the doc now holds: the step
      prose, the "ask me at most 3 short questions" line, the line telling the agent to
      carry on when no goal comes, and the local-UI offer that waits for a yes.
- [ ] Point the setup checklist's own header at the doc, so an agent handed only the
      `/kanban` setup line finds the flow.
- [ ] Fix the setup line in `README.md` and `README-zh.md`: it skips the decisions step and
      still promises three first tasks.
- [ ] Fix the same line on the landing page's install section, in all five languages.
- [ ] Set up a fresh empty repo end to end and check setup asked for nothing but the goal,
      `decisions.md` holds real settled lines, `modules.md` was written after them, and the
      leftover questions sit on the board.
- [ ] Set up a repo with existing code and check the same order still holds.
- [ ] Run setup on an empty repo and write no goal: check it stops at the goal step with no
      decisions, no map and no cards, and the board's bar still asks for the goal. Then
      write the goal by hand and run setup again — it should carry on from the next step.
