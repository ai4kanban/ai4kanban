---
title: Set up a board from the UI when the repo has none
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [55, 58, 67, 80]
modules: [local-ui]
questions:
  - "[user] On the agent's default permission settings, the setup run is blocked the moment it writes a file, so the one-button first run fails. (a) leave it — the run fails and says why, and #80 fixes the permission story for every button; (b) let this one run ask for more freedom, so a fresh repo works on the first press. Recommend (a)."
---

Let a user who starts the UI in a repo with no board create one from the browser, instead
of hitting an error page and going to read the docs.

## Today
- The UI is published on npm on its own, so a user can run it before installing the skill.
- With no board in the repo, the page fails. The user sees a crash, not a next step.
- Setting up a board is a terminal step the UI never offers, even to a user who did install
  the skill first.

## Scope
- When the UI cannot find a board, it shows a setup screen instead of an error. The screen
  names the folder it looked in, so a user pointed at the wrong repo can see that at once.
- The screen has one button: set up the board here. It says in plain words what will be
  created and where.
- Pressing it starts a normal agent run, with a live log like every other run. Nothing is
  created before the run; the run creates the board itself, with the right tracks the first
  time.
- The run follows the published install prompt, so there is one setup flow and not a second
  one that drifts from it. It fetches the prompt from the same address the README hands a
  terminal user. There is no second copy inside the UI.
- That prompt also installs the skill, which a user who came from npm does not have yet.
- The run asks nothing. It reads the repo for the project's name and description, its
  tracks, and its module map, and decides all of them itself, like every other run here.
- The run ends by proposing the first three tasks, so the user lands on a board with cards
  on it instead of an empty one.
- The screen stays put while the run goes. A finished run lands on the board with no further
  step and no restart. A failed run shows on the screen with its log and a try-again button.
- The setup screen also comes back on its own while the board is still unfinished — the
  project settings file still holds the blanks the setup fills in. So a run that died
  halfway never opens as a normal empty board, and the user is never stuck with a board no
  button can drive. Pressing the button again on a half-finished board is safe.
- Only one setup run at a time, like create and propose.
- Once the board exists, the setup run sits in the runs panel like every other run.
- The screen also says what to do if this is not the repo you meant: point the server at
  another folder. Link to where that is documented; do not restate it here.
- A board that is already set up sees none of this.

## What the user does
- Runs `npx ai4kanban-ui` in a new project, sees "no board here yet", presses one button,
  watches the log, and lands on a board with their own tracks and their first three cards.

## Decided by the agent
- Create the board first, or let the run do it? Let the run do it. The run works in the
  folder the server was pointed at and writes its log outside the board, so nothing has to
  exist beforehand.
- Create it with default tracks and swap them in later? No. The board script only ever adds
  a track, so a swap would mean hand-editing board files, and a board that already exists
  makes the prompt's own setup step do nothing.
- Write our own setup flow, or reuse the install prompt? Reuse it. It already covers the
  skill, the board, the settings, and the module map, and one owner keeps the terminal path
  and the UI path from drifting apart.
- Ship a copy of the prompt with the UI for offline use? No. The prompt's first step
  downloads the skill, so setup needs the network either way, and a second copy would drift.
- Fork the prompt to stop it asking? No. The run sends the published prompt plus the UI's
  own framing — decide every value yourself, don't ask, skip the steps that don't apply
  here. That is how every other run in this UI is built.
- How does the framing name the steps to skip? By what they do, not by their number. The
  prompt is fetched fresh and its numbering can change.
- Stop at a configured board, or go on to propose tasks? Propose. The terminal install ends
  there too, and an empty board gives the user nothing to do.
- What if the server restarts mid-setup? The setup screen comes back and the button works
  again. That matches every other run: a run whose server died is gone, and you press the
  button again.
- Should a board someone set up in the terminal and never filled in also see this screen?
  Yes. It is the same dead end, and the same one button fixes it.

## Todo
- [ ] Show the setup screen instead of failing when no board is found, naming the folder
      that was searched.
- [ ] Show the same screen when the board exists but its settings were never filled in.
- [ ] Add the set-up-the-board action: fetch the published install prompt and run the agent
      through it, with the UI's own framing so it asks nothing and skips the steps that
      don't apply.
- [ ] Give that run somewhere to write its log outside the board, and start it in the folder
      the server was pointed at.
- [ ] Allow only one setup run at a time.
- [ ] Show that run's live log on the setup screen, land on the board when it ends, and show
      a failed run with a try-again button.
- [ ] Show the setup run in the runs panel once the board exists.
- [ ] Say on the screen how to point the server at a different repo, linking to the doc.
- [ ] Update `skill/references/local-ui.md`: a repo with no board is now a fine place to
      start the UI.
- [ ] Update the Quick start in `README.md` and `README-zh.md` with this second way in.
- [ ] Update `kanban-ui/README.md` with the first-run screen.
- [ ] Write the new way in into the site copy in `web/i18n/en.ts`.
- [ ] Start the UI in a folder with no board and no skill installed, press the button, and
      check the skill arrives and the board comes up filled in.
- [ ] Kill the run halfway, reload, and check the setup screen comes back and the button
      still works.
