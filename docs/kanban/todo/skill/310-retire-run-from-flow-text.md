---
title: "Name the three levels: delivery, run, session"
track: skill
priority: med
roi: med
status: ready
release: 0.8.0
blocked_by: []
related: []
modules: [skill]
questions: []
---

The board has three nested things and only two names for them, and one of those names points at
two of them. Auto-delivery called every agent invocation a **session**, but that is also what
Claude Code and Codex call their own conversation — the one the board keeps as `resumeId` and
continues on a resume. Meanwhile the guides an agent reads and the help a user reads still call
the middle level a run. Name all three levels, and say each one the same way everywhere.

## Worth noting
- **The three levels**: a **delivery** is the whole card lifecycle; a **run** is one execution
  attempt inside it — implement, review, correct; a **session** (or thread) is the provider's own
  agent conversation that a run talks to.
- **Run is the middle level, not a word to retire**: a run ends and hands off, and continuing one
  mints a fresh run while resuming the provider's session. Two lifetimes, so two names.
- **Nothing behaves differently**: this is the words only — no command, screen, record or flow
  changes what it does.
- **`akb runs` keeps its name**: it lists runs, which is exactly what it does.
- **The UI's Sessions panel becomes Runs**: it shows one row per execution, which is the list
  `akb runs` prints. The landing page's mock of that panel is renamed with it, so the site and
  the product read the same.
- **A reader is told what a session is**: today nothing says a resume continues the coding agent's
  own conversation, so the third level has to be stated once rather than inferred.

<!-- agent -->

## Today
- **"Session" names two different things at once**: the board's own id for one execution is minted
  fresh on every resume (`cli/src/lib/agent/sessions.ts:548`), while the provider's session sits
  beside it in `resumeId` (`:558`). The CLI prints the first one as "session"
  (`cli/src/commands/run.ts:65`, `:231`, `:342`).
- **#301 swept the live surfaces the wrong way**: rows, panels, log lines and the card page were
  renamed to "session" when deliveries landed; under the three levels those are runs. The panel is
  headed "Sessions" (`kanban-ui/components/sessions.tsx:407`) and the header button reads "Session
  history" (`:322`).
- **The guides are split down the middle**: `review.md` (14 lines), `refine.md`, `propose.md` and
  `board.md` say "session" for one execution, while `setup.md`, `recurring-task.md`,
  `changelog.md`, `module-map.md`, `plan-release.md`, `local-ui.md` and `ui-design.md` say "run".
- **Most of the flow text is not in `cli/src/guide/`**: `akb help runs` is
  `cli/src/lib/agent/manual.ts`, the resume and boldness prompts are `prompts.ts`, the review and
  worktree instructions are `flow.ts`, the stop reasons are `review.ts:146`, and the agent-picker
  blurbs are `capabilities.ts:33,39,63` — all "session", all read by a user or an agent.
- **Nothing names the provider's conversation**: no text tells a reader that a resume continues the
  coding agent's own session.

## Scope
- **One execution attempt is a run**: everywhere the word reaches a user or an agent — the CLI's
  help and output, the flow text in `cli/src/guide/` and in `cli/src/lib/agent/`, the kanban-ui
  text #301 swept, `docs/guides/`, and the site's mock of the runs panel.
- **The whole card lifecycle stays a delivery**: unchanged from auto-delivery.
- **"Session" only ever means the provider's conversation**: what `resumeId` names and a resume
  continues. Say it once where resume is explained, so the reader learns the third level.
- **The verb is left alone**: "run the tests", "the flow runs", "run `akb board archive <id>`".
- **Identifiers, filenames and types keep their names**: `sessionId`, `sessions.ts`, `SessionView`,
  `.sessions.json`. Renaming them is a separate card if it is worth doing.
- **A stored value is not text**: `stop: 'session'` in a delivery record
  (`cli/src/lib/agent/types.ts:215`) is data on disk — renaming it would rewrite records, so it
  stays.
- **A correct "session" stays**: a chat session, a shell session's PATH, and the provider's session
  files under `~/.codex` already mean the third level.
- **Nothing on screen moves**: no command is added or removed and no layout changes — only words.
- **The board's own memory is untouched**: `docs/kanban/memory/` is a record, not live text.

## Todo
- [ ] Rewrite the run/session nouns in the CLI's help: `cli/bin/ai4kanban.mjs`,
      `cli/src/lib/help.ts`, and the `akb help runs` manual in `cli/src/lib/agent/manual.ts`.
- [ ] Rewrite the run/session nouns in the flow text agents are given: `cli/src/guide/*.md`, and
      the strings in `cli/src/lib/agent/prompts.ts`, `flow.ts`, `review.ts` and `capabilities.ts`.
- [ ] Change the CLI's own output so one execution reads as a run: `cli/src/commands/run.ts:65`,
      `:231`, `:342`, the `openResume` errors at `cli/src/lib/agent/sessions.ts:536-541`, and the
      run-level lines in `watch.ts:370` and `acp.ts:401`.
- [ ] Rewrite the user-visible "session" text in `kanban-ui/`, including what #301 swept: the panel
      heading and header button in `components/sessions.tsx`, and the strings in `Board.tsx`,
      `Setup.tsx`, `Configuration.tsx`, `ReleasePicker.tsx` and `desktop.tsx`.
- [ ] Rename the site's mock of that panel to match: `web/components/shots/ShotSessions.tsx` and
      the `session log` tag in `web/components/shots/nb.tsx`.
- [ ] Rewrite the lines in `docs/guides/` that call one execution a session (`daily-loop.md:46`,
      `:260`), leaving the ones that already mean a chat or the provider's own files.
- [ ] Say once, where resume is explained, that resuming continues the coding agent's own session
      while the board starts a fresh run.
- [ ] Re-read the result for a run called a delivery, or the reverse, and fix what the sweep got
      wrong.

## Decided by the agent
- **How far does the sweep reach?**: every surface a user or an agent reads — the CLI's help and
  output, the flow text agents are given, `kanban-ui`, `docs/guides/`, and the site's mock of the
  runs panel. `docs/kanban/config.md` already names `docs/guides/` and the site copy as docs this
  work keeps in sync.
- **The board's own memory is left out**: `docs/kanban/memory/` records what was said at the time,
  and `memory/skill/redesign.md` already carries the three-level rule that future planning reads.

### Overruled by the user
- **The verb stays**: run a check, run the tests, the flow runs. Only the noun goes.

## Source
- The auto-delivery vocabulary in commit `1127a91`, corrected by the user: delivery, run and
  session are three levels, not two.
