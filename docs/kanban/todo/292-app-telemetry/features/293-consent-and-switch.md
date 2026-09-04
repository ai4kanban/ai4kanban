---
title: Disclose default-on usage reporting during onboarding
track: features
priority: high
roi: high
status: todo
release: 0.9.0
blocked_by: []
related: [292]
modules: [local-ui, skill, site]
questions:
  - question: "[user] The published privacy policy tells everyone using the app today that no usage data, telemetry or crash reports are collected. What happens on those machines when they update to the release that adds reporting?"
    mode: single
    options:
      - on for them too — the same one-time disclosure appears once before the board, and nothing is sent until they press Continue
      - off for them — an install that existed before this release starts off and its disclosure shows the switch off, so only new installs are on by default
    recommend: [1]
---

Optional usage reporting starts on. One required onboarding step discloses it before a board
opens, with sharing already enabled and a switch to turn it off before continuing. The step
never returns; the switch stays in Configuration → General, and the published privacy policy
is updated to match.

## Worth noting
- **Reporting is on by default**: Onboarding presents the disclosure with sharing enabled;
  the user may turn it off before continuing or later in Configuration → General.
- **The step blocks onboarding only**: It has to be answered to finish setup, is shown once
  per machine rather than once per board, and never overlays a board afterwards.
- **The step is the only notice a local user gets**: The published policy promises a
  by-hand email for a material change, which reaches Cloud accounts only. For everyone
  else the notice is this step and the amended page.

<!-- agent -->

## Today
- The app reaches the network once already: on launch it asks GitHub for the newest
  release so it can say an update is out. Nothing about how the app is used is reported.
- `~/.ai4kanban/` already holds what a machine remembers: `settings.json` (language,
  notification silence) and `machine.json` (the machine id Cloud compares). The desktop
  app, the board UI and a terminal `akb` all reach it through the command, so this card
  adds keys rather than a store.
- `settings.json`'s reader answers a missing file and an unreadable one the same way —
  both read as unset — which a setting that is on when absent cannot afford.
- The first run (`kanban-ui/components/FirstRun.tsx`) belongs to the board, not the
  machine: its three steps are boxes in that repository's `setup-checklist.md`, every step
  offers a way out to the board, and a board that is already set up never shows it.
- The site already publishes a privacy policy (`web/legal/privacy.mdx`, English only). It
  states that the app collects no usage data, telemetry or crash reports, that its one
  outbound call is to `api.github.com`, and that nothing about app use is retained.
- Configuration → General has no usage-reporting control; its groups are Setup, Delivery,
  Runs and Language.

## Scope
- Optional usage reporting is on when the machine-wide answer is absent. A file that exists
  but cannot be read stops sending until it can be read again, so a saved opt-out is never
  guessed away.
- The setting, the completed-disclosure state and the install id are keys in
  `~/.ai4kanban/settings.json`. The app reads and changes them through the command.
- That file is the group's one place for anything a machine must remember about reporting.
  #296's per-board ids go in it too, rather than in a second store.
- Nothing about telemetry is written inside `docs/kanban/`, so a board that is committed
  and cloned never carries one person's answer to everybody else.
- One **Help improve AI4Kanban** step is shown the first time the app opens on a machine
  whose file holds no answer: first in the setup run on a new board, and on its own before
  the board on a machine whose board is already set up.
- The step says: "Share anonymous feature use and failures. Never code, card text, project
  names or file paths." Its **Share anonymous usage** switch starts on.
- The step is not a setup-checklist box and offers none of the run's ways out. **Continue**
  is the only way past it; turning the switch off does not prevent continuing.
- **Continue** saves the shown setting and records that the disclosure was shown. A save
  failure keeps the step open and shows the error there, and the step returns on the next
  open.
- **Privacy details** opens the published privacy policy.
- The app queues and sends no usage event before that step is completed. `akb` does not
  wait for it and never prompts; the README, the site and the policy are a terminal-only
  user's disclosure.
- Once the step is recorded, it never appears again — on another board, or after a
  reporting-policy update. The published policy remains the current disclosure.
- Configuration → General gains a Privacy group with one **Usage reporting** row: the
  switch, a short description and a link to the full list of events and fields.
- An anonymous install id is made when the first event is queued: a random value, never
  derived from the machine, the user or the repository, and never `machine.json`'s id.
- The row and `akb telemetry status` show that id while reporting is on and one exists;
  before the first event they say nothing has been sent yet.
- Turning reporting off stops sending immediately, drops anything queued and not yet sent,
  and forgets the id. Turning it on again makes a new one; the old one is not kept.
- `akb telemetry status|on|off` reads or changes the same machine-wide answer, which is on
  when absent, so terminal-only users can turn it off without opening the app.
- The published privacy policy is amended, not added to: its short version, "Using the app"
  and "Data retention" say that reporting is on by default, list every event and field,
  where it is stored, how long it is kept, and how to have it deleted with the install id.
  Its effective date changes.
- The page also names the update check the app already makes, says that turning usage
  reporting off does not stop it, and distinguishes optional AI4Kanban usage reporting from
  prompts and code context intentionally sent through a configured coding agent to do work.
- The README and the site say anonymous reporting is on by default, can be disabled, and
  link to that page.
- Out of scope: sending anything — #295 and #296 do that.

## Todo
- [ ] add the reporting keys to `~/.ai4kanban/settings.json`, on when absent, and stop sending when the file exists but cannot be read
- [ ] make and store an anonymous install id when the first event is queued, and forget it when reporting is turned off
- [ ] let the app read and change the setting through the command, not through its own store
- [ ] show the disclosure step once per machine — first in the setup run, on its own for a board already set up — with no way past it but Continue
- [ ] add the Privacy group with the same switch under Configuration → General, showing the install id while reporting is on
- [ ] stop sending and drop the queue the moment it is turned off
- [ ] add `akb telemetry status|on|off`, reading and changing the setting with no prompt
- [ ] amend the privacy policy: what is collected by default, every event and field, retention, deletion by install id, the agent-data distinction, the update check and a new effective date
- [ ] say in the README and on the site that reporting is on by default, can be disabled, and link the page
- [ ] check the step with the switch on and off, on a second board, on a machine already set up, and on a save failure, an unreadable file, a later disable and re-enable, and no network

## By `ui-design` agent

- **Onboarding**: One focused step shows the disclosure, a default-on **Share anonymous
  usage** switch, **Privacy details**, and one **Continue** button.
- **General setting**: One **Usage reporting** row under a Privacy group states **On/Off**,
  carries the switch, repeats the short disclosure and links to the full list.
- **Failure**: Onboarding does not advance when its choice cannot be saved; a later toggle
  failure keeps the previous value and uses Configuration's existing top-level error treatment.

<Mockup src=".mockups/293/a.tsx" label="A" />

## Decided by the agent
- **One setting, not one per surface** — a user who says no once has said no to the app,
  the command and everything either of them later adds.
- **Where the setting lives** — `~/.ai4kanban/settings.json`, where every machine-wide
  answer already lives and which the app already reads and writes through the command. Its
  reader cannot tell an unreadable file from an unset one, so the reporting keys need a
  reader that can: a setting that is on when absent would otherwise send from a machine
  that said no.
- **Why the disclosure is not a setup-checklist box** — the checklist is committed with the
  repository and asked once per board, while the answer is machine-wide. Its state belongs
  beside the setting, which is also what stops a second board asking again.
- **Why the step comes first in a new board's setup run** — the steps after it pick and
  test an agent and run one over the repository, which is exactly what #295 counts. Placed
  after them, how far people get through setup would be invisible.
- **Why the install id is not derived from the machine** — a value computed from hardware
  or a home folder path, and `machine.json`'s id equally, survives a reinstall and turning
  the setting off, which makes it an identifier the user cannot get rid of.
- **Why nothing goes in the repository** — a board is committed to git. A setting kept
  there would be shared with everyone who clones the repo and would answer for them.
- **The update check stays either way** — asking GitHub whether a newer release exists
  tells the user something; it is not a report about them. The privacy page names it so
  the page is the whole picture rather than a partial one.
- **Why the policy is amended rather than joined by a second page** — the published page
  already tells every current user that the app collects nothing. A new page beside it
  would leave that sentence standing.

### Overruled by the user
- **Private by default** — missing, unanswered and declined consent all meant off, and no
  usage event or reporting identifier left the machine.
- **No consent wall** — the one-time invitation sat above the board instead of blocking
  anything, the board stayed usable while it was there, and the choice lived in
  Configuration → Privacy.
- **Why this does not copy the common opt-out pattern** — Codex, Claude Code and VS Code
  document default-on operational metrics with a setting or environment-variable opt-out;
  the earlier plan held that AI4Kanban's local-first promise was clearer if optional
  reporting instead required an affirmative action.

## Source
- OpenAI Codex advanced configuration documents anonymous usage and health metrics as on by
  default, with `[analytics] enabled = false` as the machine-wide opt-out:
  https://learn.chatgpt.com/es-419/docs/config-file/config-advanced#metrics
- Claude Code documents default-on operational metrics for direct Anthropic use and
  `DISABLE_TELEMETRY=1` as the opt-out: https://code.claude.com/docs/en/data-usage
- Cursor documents choosing Privacy Mode during onboarding or later in settings:
  https://docs.cursor.com/account/privacy
- Gemini CLI exposes `/privacy` to show its notice and let the user consent to data
  collection for service improvement:
  https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md#privacy
- VS Code documents default-on usage, error and crash telemetry with one settings control:
  https://code.visualstudio.com/docs/configure/telemetry
