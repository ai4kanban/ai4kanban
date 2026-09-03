---
title: Keep optional usage reporting off until the user opts in
track: features
priority: high
roi: high
status: todo
release: 0.9.0
blocked_by: []
related: [292]
modules: [local-ui, skill]
questions: []
---

Optional usage reporting stays off until the user explicitly turns it on. On first app
open, the board shows one compact, non-blocking invitation; declining or leaving it
unanswered keeps reporting off and leaves the whole app usable.

## Worth noting
- **Private by default**: Missing, unanswered and declined consent all mean off; no usage
  event or reporting identifier leaves the machine.
- **No consent wall**: The one-time invitation sits above the board instead of blocking it,
  and the same choice remains available in Configuration → Privacy.
- **Material changes ask again**: Adding an event within the disclosed purpose and data
  categories only updates the public list; a new purpose or data category resets reporting
  to off and shows the invitation once more.

<!-- agent -->

## Today
- The app reaches the network once already: on launch it asks GitHub for the newest
  release so it can say an update is out. Nothing about how the app is used is reported.
- Machine-wide settings have no shared file that both the app and `akb` can read.
- Configuration has no Privacy section.
- The site publishes no privacy page today, so #293 writes the first one.

## Scope
- Optional usage reporting is off when the setting is absent, declined or unreadable.
- On the first eligible app open, the app records off before showing one inline invitation
  above the board. The board, cards and controls remain usable while it is present.
- The invitation says: **Help improve AI4Kanban** — "Share anonymous feature use and
  failures. Never code, card text, project names or file paths." It offers **Details**,
  **No thanks** and **Share anonymous usage**.
- Either answer removes the invitation permanently. Leaving it unanswered sends nothing;
  the next launch does not ask again.
- **Details** opens the published privacy page. The page distinguishes optional AI4Kanban
  usage reporting from the prompts and code context a user intentionally sends through a
  configured coding agent to perform work.
- Configuration gains a Privacy section with one **Usage reporting** row, the answer in
  words, the same short disclosure and a link to the full list.
- While reporting is on, the section and `akb telemetry status` show the install id needed
  to request deletion; it disappears when reporting is turned off.
- Turning it off stops sending immediately and drops anything queued and not yet sent.
- An anonymous install id is made on the machine the first time sending is allowed: a
  random value, never derived from the machine, the user, or the repository.
- Turning telemetry off and on again makes a new install id; the old one is not kept.
- The setting, disclosure version and install id are kept in one file that `akb` owns,
  outside every repository. The app reads and changes them through the command.
- That file is the group's one place for anything a machine must remember about reporting.
  #296's per-board ids go in it too, rather than in a second store.
- Nothing about telemetry is written inside `docs/kanban/`, so a board that is committed
  and cloned never carries one person's answer to everybody else.
- `akb` never prompts. `akb telemetry status|on|off` reads or changes the same machine-wide
  choice; an explicit `on` is consent from a terminal-only user.
- The disclosure version changes only when the reporting purpose or data categories expand.
  An older consent then becomes off before any new-category event can be queued, and the app
  shows the updated invitation once.
- The published privacy page lists every event, every field, where it is stored, how long
  it is kept, and how to have it deleted.
- The page also names the update check the app already makes, and says that turning usage
  reporting off does not stop it.
- The README and the site say the app can report usage, that it is the user's choice, and
  link to that page.
- Out of scope: sending anything — #295 and #296 do that.

## Todo
- [ ] add the machine-wide file `akb` owns, with reporting off when absent and a disclosure version
- [ ] make and store an anonymous install id when sending is first allowed
- [ ] let the app read and change the setting through the command, not through its own store
- [ ] show the one-time, non-blocking board invitation with the exact disclosure and actions
- [ ] add the same switch to a section in Configuration, stating the current answer in words
- [ ] stop sending and drop the queue the moment it is turned off
- [ ] let `akb telemetry status|on|off` read and change the setting with no prompt, showing the install id when on
- [ ] reset consent before accepting an expanded reporting purpose or data category
- [ ] write the privacy page with every event and field, retention, deletion, agent-data distinction and update check
- [ ] say in the README and on the site that the app can report usage, and link the page
- [ ] check first-open, decline, allow, disable, re-enable, save-failure and no-network paths

## By `ui-design` agent

- **First open**: One compact strip sits between the header and board columns. It uses no
  scrim, focus trap or auto-opened settings; the user can keep working before answering.
- **Privacy setting**: One settings row states **Usage reporting is off/on**, carries the
  switch, repeats the short disclosure and links to the full list.
- **Failure**: A failed attempt to enable reporting leaves it off and uses Configuration's
  existing top-level error treatment.

<Mockup src=".mockups/293/a.tsx" label="A" />

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
- **Why this does not copy the common opt-out pattern** — Codex, Claude Code and VS Code
  document default-on operational metrics with a setting or environment-variable opt-out;
  AI4Kanban's local-first promise is clearer if optional reporting instead requires an
  affirmative action.

### Overruled by the user
- **Blocking first use** — the earlier design forced a modal, full-window question or
  auto-opened Configuration before the user could continue; the invitation is now inline
  and the board remains usable.

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
