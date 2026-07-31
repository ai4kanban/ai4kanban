---
title: Track setup with a checklist and show a bar until it's done
track: features
priority: high
roi: high
status: ready
blocked_by: [84]
related: [83]
modules: [skill, local-ui]
questions: []
---

Setup keeps a checklist of its own steps in `setup-checklist.md` at the board root and
ticks each box as a step finishes. The UI shows one bar until every box is ticked. The
weak-goal bar today is one special case of this; it becomes one item on the list.
Creating the first tasks is the last box: until it ticks, the board holds no cards.

This bar is the whole onboarding UI. It stays simple: when the next step needs the agent,
the bar shows the instruction to copy into the coding harness — like `/kanban setup the
current board` — and moves when the step ticks. The UI never runs setup itself.

## Today
- Setup is a run of steps with no record of which ones finished. A run that dies halfway
  leaves a board that looks done.
- The UI nags about exactly one unfinished step: when `goal.md` is judged weak, a bar
  asks the user to write the goal. Every other missing piece — an empty config, no module
  map, no first cards — shows nothing.
- Nothing in the UI says what to run next. A user with an unfinished board has to go back
  to the docs to find the setup instruction.

## Scope
- The checklist is `setup-checklist.md` at the board root, next to `config.md` — one
  fixed path the UI and every flow read. It holds one box per setup step, in the order the
  setup doc (#84) fixes.
- It is written the moment the board is scaffolded, by the install command itself, with
  the boxes install already finished ticked. So a user who installs and stops there still
  opens the UI onto the bar telling them what is left.
- Repairing an older board never writes it. `update` re-runs the scaffold on an existing
  board, and a board that was set up long ago must stay quiet.
- The script writes the file and ticks the boxes, the way it owns the rest of the board's
  state. Each setup step runs a command to tick its own box; nobody hand-edits the list,
  so the UI can rely on its shape.
- Each box says what the step is and who does it — the agent, or the UI itself, as with
  writing the goal. That is how the bar knows when to show a copy line and when to show a
  button.
- The file's presence is the flag. It is there while setup is unfinished, and the tick
  that closes the last box deletes it. A board with no file is a board that is set up — so
  boards set up before this change stay quiet, no bar and no waiting. A fully ticked list
  is never left behind: kept, it would be clutter that also contradicts the flag.
- An empty board is not a flag. A board with no checklist and no cards shows no bar at
  all: empty columns, and the goal nudge only if `goal.md` is still the seed. Only the
  file says setup is unfinished — never the absence of cards.
- Nothing to show when there is no board. The UI finds a board by walking up to a
  `docs/kanban/todo/` folder; with no folder there is no board root, no checklist and no
  bar. It keeps saying it found no board here, and installing stays a terminal command
  (`npx ai4kanban install`). The bar starts once a board exists.
- Generalize the goal bar into a setup bar: it shows while the file is there, says how far
  setup got and which step comes next, and drops out when setup deletes the file. The weak
  goal is one item on the list, not its own bar; writing the goal stays that item's action.
- The goal can turn weak again long after setup, when an agent re-judges it. The bar comes
  back then, with that one item on it — the goal nudge we have today, unchanged. Proposals
  are still judged against the goal, so the nag still earns its place.
- When the next step needs the agent, the bar shows the instruction to copy into the
  coding harness — like `/kanban setup the current board` — with a copy button. The
  wording is the UI's, not the checklist's, and it is one line rather than one per step:
  setup picks up at the first unticked box, so the same line restarts it wherever it
  stopped. The UI does not start the run; the user pastes it and the bar moves when the
  box ticks.
- The install command ends on that same one instruction instead of listing the steps it
  can't do. The checklist carries the list now, and two lists would drift.
- The checklist is also how any flow asks "is setup done" — it reads whether the file is
  there instead of guessing from blanks in `config.md`.
- No cards before the last box. Creating the first tasks (#91) is the checklist's last
  item; no earlier setup step creates a card. While the file is there, the kanban flows
  that create cards — propose, add — create nothing and tell the user to finish setup
  first. Setup's own last step is the exception: it creates the first tasks, then deletes
  the file.
- A card the user writes by hand, outside the skill, is not blocked. It is rare, and
  nothing on the board could stop it anyway.

## What the user sees
- One bar that says how far setup got and what comes next, until the board is fully set
  up. A setup that died halfway is visible at a glance instead of looking finished.
- Installing and then walking away is one of those halfway states: the board is there, the
  bar is up, and it says what to run next.
- When the next step needs the agent, the bar hands them the instruction to copy into
  their coding harness. Proceeding is one paste, not a trip to the docs.
- No cards until setup's last step. The first cards appear at the moment the bar goes
  away, never before. Asking the skill for a card before that gets a plain "finish setup
  first".
- Long after setup, a goal that goes weak again brings the same bar back with one item on
  it.
- A board that is set up and simply has no cards left looks the way it does today: empty
  columns and no bar. Nothing nags a user who finished their backlog.
- Updating an old board changes nothing: no bar appears and no step is waited for.

## Decided by the agent
- What does a missing checklist mean? Setup is done. Boards set up before this change
  have no file, and they must never start nagging.
- How can the bar return for a weak goal when the file is deleted? The bar reads two
  things: the checklist while it exists, and `goal.md`'s judgment at all times. The
  checklist is never rewritten after setup.
- Why does the install command write it rather than the agent's setup flow? The gap
  between installing and starting the agent is the likeliest place to stop. If the file
  only appeared when the agent flow began, a user who stopped in that gap would open a
  board that looks finished — the exact failure this card exists to fix.
- Where does the copyable instruction come from? The UI, beside the other harness prompts
  in `kanban-ui/lib/agent.ts`. The line says how the skill is invoked, and files under
  `skill/` never say that — the same rule that keeps `/kanban. Implement task 12` in the
  UI today. The checklist names each step and who does it, never how to invoke anything.
- One wording per harness? No, one for all of them, like every prompt the UI sends today.
  A harness whose syntax differs is that harness's card, not this one.
- Does the UI gray out its own Add and Propose buttons while setup is unfinished? No.
  They spawn the kanban flows, and the flow is where the wait lives — one rule in one
  place. The run comes back saying setup isn't finished.
- Can the setup bar be dismissed? Yes, like every notice bar: a ✕ hides it for the
  browser session and writes nothing to the board.
- What does the bar do with no board at all? Nothing — there is no board root to read a
  file from. The no-board case stays the "no board here" message the UI already has; a
  one-button in-UI setup was rejected (see local-ui `rejected.md`). That message doesn't
  reach the browser today, and fixing that is #110.
- What about a board with no checklist and no cards? No bar. Empty is not a signal, the
  file is — otherwise a user who cleared their backlog would be told to finish a setup
  that finished months ago.

## Todo
- [ ] Write `setup-checklist.md` when the board is scaffolded, one box per setup step in
      the order #84's setup doc fixes, with what install already did ticked.
- [ ] Leave it out of the repair path, so updating an old board never plants a checklist.
- [ ] Give each box a fixed name and a mark for who does that step — the agent, or the UI
      itself.
- [ ] Add the command that ticks one box, and make each setup step run it when it
      finishes.
- [ ] Make the tick that closes the last box delete the file, so a board with no file is a
      board that is set up.
- [ ] Turn the goal bar into the setup bar: show it while the file is there, say how far
      setup got and which step is next, keep write-the-goal as the goal item's button.
- [ ] Keep the one-item goal bar for a goal judged weak after setup, when there is no
      checklist file.
- [ ] Show no bar when the file is absent and the goal is fine, so existing boards stay
      quiet — including a set-up board with no cards left.
- [ ] Show the copyable harness instruction on the bar when the next step needs the
      agent, like `/kanban setup the current board`, with a copy button. Keep the one
      wording in `kanban-ui/lib/agent.ts`, next to the other harness prompts.
- [ ] End the install command on that same instruction instead of the list of steps it
      prints today.
- [ ] Put creating the first tasks (#91) last on the checklist and make sure no earlier
      step creates a card.
- [ ] Make the propose and add flows stop while the checklist file is there and tell the
      user to finish setup first.
- [ ] Add the checklist to the skill's own docs: the board layout and the list of
      commands.
- [ ] Update `kanban-ui/README.md` for the setup bar and its copy button.
- [ ] Install into a fresh repo, open the UI without running the agent flow, and check the
      bar is up with the remaining steps and the board has no cards.
- [ ] Finish setup and check the file is gone, the bar goes away and the first cards
      appear.
- [ ] Run the update command on a board that was set up before this change and check no
      bar appears.
- [ ] On a finished board, mark the goal weak again and check the bar comes back with
      just the goal item.
