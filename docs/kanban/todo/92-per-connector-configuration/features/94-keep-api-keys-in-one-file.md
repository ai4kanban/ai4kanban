---
title: Keep API keys in one file, not scattered
track: features
priority: med
roi: med
status: todo
release: next
blocked_by: [93]
related: [92]
modules: [local-ui]
questions:
  - question: "[user] Does the Configuration dialog write the key into docs/kanban/.env, or is that file hand-edited only?"
    mode: single
    options:
      - the dialog writes it — one place, and you never leave the board to set a key
      - hand-edited only — the board reads the file and never writes a secret
    recommend: [1]
---

The board has nowhere to put an API key. The only way to get one to a run is to export it
somewhere before starting the UI server — a shell profile, a wrapper script, a different
place on every machine — and nothing on screen says which one is in effect. Give the board
one fixed place for keys: `docs/kanban/.env`, next to `ui.config.json`.

## Today
- No box, no file, no setting holds a key.
- A run inherits the whole environment the server was started in. A key someone exported
  months ago still decides where their runs go, and the dialog never shows it.

## Scope
- One file, `docs/kanban/.env`, beside `ui.config.json`. Plain `NAME=value` lines, one per
  line. Every key the board uses is in there and nowhere else.
- The file never reaches git. The board writes `docs/kanban/.gitignore` with `.env` in it,
  so a fresh board is safe without the user editing anything.
- A connector can mark one of its settings a secret — #93 gave it a text box and a
  pick-one list, this is the third kind. A secret says which environment variable it
  reaches the run under. Its value goes to `.env`; every other setting keeps going to
  `ui.config.json`.
- Claude Code gets one secret: the Anthropic API key, optional. Left empty, a run works
  exactly as it does today, on whatever login the `claude` CLI has. Filled in, the run uses
  the key. #95 folds this into the provider list.
- The dialog has a box for it. Type a key, save, and it lands in `docs/kanban/.env`. It is
  never read back: once saved the box says the key is set, with Replace and Clear beside
  it.
- The key is never shown on screen, never printed in a run's log, and never written to
  `ui.config.json`.
- What is in `.env` wins. When a run starts, the board sets the declared variables from
  that file, so what the dialog shows is what the run gets. A variable `.env` doesn't name
  is left as it is today — clearing the rest of the environment belongs to #95, where
  picking a provider is what makes it mean something.
- A run that needs a key it doesn't have fails with a plain reason — which key is missing
  and which file to put it in — instead of the vendor's 401 buried in the log.
- Telling the user before they press a button is #96.
- Out of this card: a general place to park any environment variable a run should see.
  `.env` holds the keys the board's own settings declare, nothing else.

## Todo
- [ ] Make `docs/kanban/.env` the board's one place for keys — plain `NAME=value` lines —
      read when a run starts.
- [ ] Keep it out of git: writing the file also writes `docs/kanban/.gitignore` with `.env`
      in it.
- [ ] Let a connector mark a setting a secret and name the variable it reaches the run
      under, so its value goes to `.env` and never to `ui.config.json`.
- [ ] Give Claude Code its optional Anthropic API key secret, empty by default, so an
      untouched board runs exactly as it does today.
- [ ] Show a secret in the Configuration dialog as set or not set, with Replace and Clear,
      and never show the value back.
- [ ] Keep the key out of every run log.
- [ ] Fail a run whose key is missing with a plain reason naming the key and the file,
      instead of the vendor's 401.
- [ ] Say in `kanban-ui/README.md` that keys live in `docs/kanban/.env`, that the file is
      ignored by git, and that nothing else in the board holds a key.
- [ ] Check it by hand: type a key, see it land in `docs/kanban/.env` and nowhere else; run
      `git status` and see the file ignored; clear it and see the run fail with the plain
      reason.

## Decided by the agent
- **Why a file the board owns, and not the user's shell?** A shell export is one setup per
  machine, invisible on screen, and needs a server restart to change. One file next to the
  board is a place the dialog can write, read back as set or not set, and name in an error.
- **Is the key ever shown back?** No. Set or not set, Replace, Clear. Reading a key back
  into a browser tab buys nothing — a user who forgot it makes a new one.
- **Does a key already exported in the shell stop working?** No. `.env` wins where it names
  a variable, and where it doesn't, a run inherits what it does today. Dropping the
  variables the pick doesn't need is #95's job, not a side effect of adding a file.
- **Where does the ignore rule go?** `docs/kanban/.gitignore`, written by the board. The
  repo's root `.gitignore` is the user's file, and a board that edits it is a board that
  surprises them.
- **Why one secret on Claude Code now, when #95 brings the provider list?** So this card
  works and can be checked on its own. It is also the same key #95's Anthropic API provider
  needs, so nothing is built twice.
