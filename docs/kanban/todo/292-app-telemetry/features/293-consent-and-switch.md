---
title: Ask before any usage data leaves the machine, and let it be turned off
track: 292-app-telemetry/features
priority: high
roi: high
status: todo
release: 0.7.2
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
---

Nothing may be sent off a user's machine before they have been asked in plain words and
said yes. Build that step, the setting that reverses it, and the anonymous install id
every other card in this group depends on.

## Today
- The app reaches the network once already: on launch it asks GitHub for the newest
  release so it can say an update is out. Nothing about how the app is used is reported.
- Every board setting — which agent runs, and what each one is set to — is kept in
  `docs/kanban/ui.config.json`, inside the user's repository. The desktop app keeps a
  small file of its own outside every repository, but only the app can read it; the `akb`
  command cannot.
- Configuration holds Harness, Skill and Agents. There is no place a privacy setting
  would go.

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

### Worth noting
- `akb` never prompts, so a user who only ever works from a terminal and never opens the
  app is never asked and never counted. The alternative — prompting in the terminal —
  would hang the coding agent runs that drive the command.
