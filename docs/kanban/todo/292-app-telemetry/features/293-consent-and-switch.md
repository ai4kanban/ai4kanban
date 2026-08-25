---
title: Ask before any usage data leaves the machine, and let it be turned off
track: 292-app-telemetry/features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [292]
modules: [local-ui, skill]
questions:
  - question: "[user] Is telemetry off until the user turns it on, or on until they turn it off?"
    mode: single
    options:
      - off until the user turns it on — a local-first product that sends nothing by default is the promise the site already makes
      - "on until the user turns it off — far more data, but it contradicts \"nothing leaves your repo\""
    recommend: [1]
  - question: "[user] Which layout for the consent ask? — see the `ui-design` section"
    mode: single
    options:
      - A — a panel over the user's own board on first open; the modal ignores Esc and click-away
      - B — the whole window is the question until it is answered
      - C — the Configuration dialog opens itself on the new Privacy section, which is the question
    recommend: [1]
---

Nothing may be sent off a user's machine before they have been asked in plain words and
said yes. Build that step, the setting that reverses it, and the anonymous install id
every other card in this group depends on.

## Worth noting
- `akb` never prompts, so a user who only ever works from a terminal and never opens the
  app is never asked and never counted. The alternative — prompting in the terminal —
  would hang the coding agent runs that drive the command.
- The ask happens once, and it is consent to the practice rather than to a fixed list. A
  later card that adds an event adds it to the published page but does not ask again.

## By `ui-design` agent

The card changes two screens: the one-time ask, and a new Privacy section in Configuration.
All three options carry the same words and the same Privacy section content — they differ in
where the ask stands and in the shape the section takes.

### What the ask says

- **The question**: "May we count how the app is used?", and under it "Nothing has left this
  machine, and nothing will until you answer."
- **One line in**: app opens, which parts of the board are used, and the board's own planning
  numbers — tied together by one random id made on this machine.
- **One line out**: card titles, goals, file paths, repo or project name, email. Nothing from
  inside the repository.
- **The link**: "See every event and field we send" opens the published privacy page.
- **Two buttons**: "Send usage data" and "Don't send" — the same pair whichever way the card's
  open question about the default is settled. Neither is worded "not now": the ask happens once,
  so a button that hints at being asked again would be a lie.
- **The way back**: "Change it any time in Configuration → Privacy."

### What the Privacy section holds

- **Where it sits**: a fourth sidebar entry under Harness, Agents and Setup, with a shield mark.
- **The answer in words, then the switch**: "Usage reporting is on." with a line saying that
  turning it off stops sending at once and throws away anything still waiting.
- **The same two lines**: what is sent and what is never sent, word for word as the ask said
  them, and the same link to the full list.
- **The update check, named**: the app still asks GitHub whether a newer release is out; the
  switch does not change that.
- **Where the answer lives**: on this machine, never inside the repository, and
  `akb telemetry off` sets the same one from a terminal.
- **When a save fails**: the switch goes back to where it was and the reason appears across the
  top of the dialog, where Configuration's errors already show.

### Layouts

<Mockup src=".mockups/293/a.tsx" label="A" />

The ask is a panel over the user's own board on the first open — no close mark, and the scrim
does not dismiss it, so the two buttons are the only way on. It reads as a question about work
that is plainly still there, and it is the least screen to build; the cost is that it is a modal
that ignores Esc and click-away, which a user with those habits will press twice before reading.

<Mockup src=".mockups/293/b.tsx" label="B" />

The ask takes the whole window in the guided first run's language, and the board does not draw
until it is answered. Nothing competes with it, there is room to set "what is sent" and "what is
never sent" side by side as equals, and it is the same screen a brand-new install can meet as a
setup step; the cost is that someone who opened the app to move a card meets a wall instead of
their board.

<Mockup src=".mockups/293/c.tsx" label="C" />

There is no separate ask: the app opens the Configuration dialog on the new Privacy section, and
that section is the question — the two buttons stand where the switch will later sit, and the
other three sections are dimmed until one is pressed. One pane to build and one wording to keep
true, and the answer is changed in the place it was asked; the cost is that a new user's first
screen is a settings dialog, and the app gains a settings dialog that can appear uninvited.

### Recommended

**A.** The promise the ask has to survive is "your board is yours and it stays here" — and A is
the only one that shows the board while asking. B answers a one-line question with a whole-window
screen the user did not ask for, and C teaches the app to open its settings by itself, which is a
worse habit than the modal is. If a brand-new install should meet this during setup as well, A's
panel is exactly what that step shows, with no second screen to write.

<!-- agent -->

## Today
- The app reaches the network once already: on launch it asks GitHub for the newest
  release so it can say an update is out. Nothing about how the app is used is reported.
- Every board setting — which agent runs, and what each one is set to — is kept in
  `docs/kanban/ui.config.json`, inside the user's repository. The desktop app keeps a
  small file of its own outside every repository, but only the app can read it; the `akb`
  command cannot.
- Configuration holds Harness, Skill and Agents. There is no place a privacy setting
  would go.
- The site publishes no privacy page today, so #293 writes the first one.

## Scope
- The user is asked once, on a screen they cannot miss, and the app carries on either way.
- The ask says in one line what is collected, in one line what is never collected, and
  gives two buttons.
- A link on that screen opens the page that lists every event and every field sent.
- Configuration gains a section with the same switch, so the answer can be changed at any
  time.
- The section states the current answer in words, not only as a switch position.
- Turning it off stops sending immediately and drops anything queued and not yet sent.
- An anonymous install id is made on the machine the first time sending is allowed: a
  random value, never derived from the machine, the user, or the repository.
- Turning telemetry off and on again makes a new install id; the old one is not kept.
- The setting and the install id are kept in one file that the `akb` command owns, outside
  every repository. The app reads and changes them through the command, so the app and the
  command share one answer and one install id.
- That file is the group's one place for anything a machine must remember about reporting.
  #296's per-board ids go in it too, rather than in a second store.
- Nothing about telemetry is written inside `docs/kanban/`, so a board that is committed
  and cloned never carries one person's answer to everybody else.
- `akb` never asks. It obeys the setting it finds and prints no prompt, because a coding
  agent usually drives it and a prompt would stop the run. A terminal-only user turns it
  on or off with one command.
- Nothing is ever sent from a machine where the ask has not been shown, even if the open
  question above is settled as on-by-default. Reporting on someone who was never told is
  the case this card exists to prevent.
- The published privacy page lists every event, every field, where it is stored, how long
  it is kept, and how to have it deleted.
- The page also names the update check the app already makes, and says that turning usage
  reporting off does not stop it.
- The README and the site say the app can report usage, that it is the user's choice, and
  link to that page.
- Out of scope: sending anything — #295 and #296 do that.

## Todo
- [ ] add the file the `akb` command owns outside every repository, and the setting in it
- [ ] make and store an anonymous install id when sending is first allowed
- [ ] let the app read and change the setting through the command, not through its own store
- [ ] show the ask once, with what is and is not collected and a link to the full list
- [ ] add the same switch to a section in Configuration, stating the current answer in words
- [ ] stop sending and drop the queue the moment it is turned off
- [ ] let `akb` read and change the setting from the command line, with no prompt
- [ ] write the privacy page that lists every event and field, and names the update check
- [ ] say in the README and on the site that the app can report usage, and link the page
- [ ] check the app works normally with the setting off and with no network

## Decided by the agent
- **One setting, not one per surface** — a user who says no once has said no to the app,
  the command and everything either of them later adds.
- **Where the setting lives** — one file the `akb` command owns outside every repository,
  not the desktop app's own store. The app already reads and writes every other setting
  through the command, and the file the app keeps today cannot be read by `akb` at all,
  which would leave the app and the command with two different answers.
- **Why the install id is not derived from the machine** — a value computed from hardware
  or a home folder path is stable across a reinstall and across turning the setting off,
  which makes it an identifier the user cannot get rid of.
- **Why nothing goes in the repository** — a board is committed to git. A setting kept
  there would be shared with everyone who clones the repo and would answer for them.
- **The update check stays either way** — asking GitHub whether a newer release exists
  tells the user something; it is not a report about them. The privacy page names it so
  the page is the whole picture rather than a partial one.
