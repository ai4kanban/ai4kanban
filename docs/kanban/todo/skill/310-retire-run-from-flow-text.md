---
title: Stop calling a session a run in the guides and the CLI help
track: skill
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: [300]
modules: [skill]
questions:
  - "[user] Does `akb runs` keep its name? The group retires \"run\" as a noun, but this is a shipped command and the panel it opens lists both deliveries and their sessions. Options: keep `akb runs` and let the command name be the one exception; rename to `akb deliveries`, which drops standalone refine and propose sessions from what the name covers; rename to `akb activity`, matching the panel the app already calls Activity, and keep `akb runs` working as an alias."
---

#300 settled the words: an Implement click starts a **delivery**, and each agent invocation inside
it is a **session**. The card page and the delivery records say that today, but the guides an agent
reads and the help a user reads still call a session a run. The same job has two names depending on
where you look, so a user meeting "A run keeps working after the command returns" cannot tell it
from the delivery the board tells them about.

## Worth noting
- **Nothing behaves differently**: this is the words only — no command, screen, record or flow
  changes what it does.
- **The verb stays**: run a check, run the tests, the flow runs. Only the noun goes.

<!-- agent -->

## Today
- **The CLI's own help calls a session a run**: `cli/bin/ai4kanban.mjs` says "watch a run", "A run
  keeps working after the command returns" and "the commands the agent calls between runs";
  `cli/src/lib/help.ts` repeats it on `changelog`, `schedule` and the board move list.
- **The flow guides call a session a run**: `setup.md`, `recurring-task.md`, `propose.md`,
  `changelog.md`, `module-map.md`, `plan-release.md`, `local-ui.md`, `board.md` and the example
  question in `ui-design.md`.
- **#301 renamed the live surfaces only**: session rows, panels, log lines and the card page were
  swept when deliveries landed; this older text was not.

## Scope
- **Every user-facing and agent-facing "run" that names a session or a delivery becomes that
  word**: the CLI help in `cli/bin/ai4kanban.mjs` and `cli/src/lib/help.ts`, and the flow guides in
  `cli/src/guide/`.
- **The verb is left alone**: "run the tests", "the flow runs", "run `akb board archive <id>`".
- **A code identifier changes only where its name reaches a user**: an internal `run`-named symbol
  no one reads stays as it is.
- **`akb runs` keeps its name unless the user says otherwise**: it is a shipped command, and the
  question below is the only thing that would change it.

## Todo
- [ ] Rewrite the "run" nouns in `cli/bin/ai4kanban.mjs` and `cli/src/lib/help.ts` to session or
      delivery, keeping every verb.
- [ ] Rewrite the "run" nouns in `cli/src/guide/*.md`, keeping every verb.
- [ ] Re-read the result for a session called a delivery, or the reverse, and fix what the sweep
      got wrong.

## Scope out
- **No behavior change**: no command is added or removed, and nothing on screen moves.
- **No rename of `akb runs`** until the question below is answered.

## Source
- #300's vocabulary, and the `plan.md` specification it quotes, in commit `1127a91`.
