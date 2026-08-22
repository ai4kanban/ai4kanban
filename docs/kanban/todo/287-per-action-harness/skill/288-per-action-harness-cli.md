---
title: Let every board action name its own harness and settings
track: skill
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [287, 289, 246]
modules: [skill]
questions: []
---
`docs/kanban/ui.config.json` holds one harness name, and that one name runs every kind of
run. Let each action — implement, run, refine, resolve, edit, create, propose, plan-release,
archive, reject — name its own harness and its own settings for it, falling back to the
board's when it names none.

## Today
- `harness` in `ui.config.json` is one name; `harnessSettings.<name>` is that harness's
  settings. `resolveHarness()` in `cli/src/lib/agent/resolve.ts` reads both once per run.
- The only thing that can hold a run to a different harness is a resume, which keeps the
  harness the run started on — and a resume is offered only while the board's harness is
  that one.
- `AgentAction` in `cli/src/lib/agent/types.ts` already names every kind of run.

## Scope
- **An action may name its own harness**, and its own settings for that harness.
- **The actions are the ten a user can start**: implement, run, refine, resolve, edit,
  create, propose, plan-release, archive, reject. `setup` always runs the global harness;
  `spec` is #246.
- **An action that names none runs the global harness** with the global settings, exactly
  as today.
- **An action's settings layer over that harness's global block**: an action set to Codex
  with no model of its own runs Codex with the model `harnessSettings.codex` holds.
- **A file written before this still reads the same**: no per-action entry means every
  action runs the global harness.
- **Resolved once, as the run starts**, so a change made mid-run reaches the next run and
  never this one.
- **Every way of starting the action uses its harness**: a typed `akb implement`, a button,
  the watcher, auto-refine, and a run that a chat starts. The chat's own turns stay on the
  chat's harness (#272).
- **A resume stays on the harness it started on**, and is offered only while that is still
  the action's harness.
- **The run's prompt calls the skill the way its harness expects**: `/kanban` on Claude
  Code, `$kanban` on Codex, the sentence on a harness with no skill syntax — taken from the
  action's harness, not the global one.
- **A harness we do not ship falls back to the global one**, and the run's log says so.
- **A harness we ship whose CLI is not installed does not fall back**: the run fails with
  the install command in its log, as today.
- **API keys stay in `docs/kanban/.env`**; an action on another harness reads that
  harness's key from the same file, under the variable name the harness declares.
- **`akb agent` can be pointed at one action** with `--action <name>`: `akb agent use`,
  `set` and `test` take it, and then offer that harness's settings instead of the global
  ones. `akb agent use --action implement ""` clears the action back to the global harness.
  A name that is not one of the ten is refused, and the message lists them.
- **A saved value is checked against the harness that will run it.**
- **Setting the global harness clears every per-action harness** — that is what "reset all
  to it" means, and the CLI does it so the UI's button and `akb agent use` agree.
- **`akb agent` prints what each action runs on**: its harness and model, and whether that
  is the global one or its own.
- **The command hands a front end the same answer**, so the UI keeps no list of its own.
- **The run list records the harness each run ran under** — it already does; check it still
  holds for a per-action run and a resume of one.
- Out: a harness per card or per run.
- Out: the spec agents (#246); this card should leave them a shape to reuse.
- Out: a chat's harness or model (#272).

## Todo
- [ ] Add a per-action block to `ui.config.json` beside `harness`, holding a harness name
      and that harness's settings per action, with an absent action meaning "global".
- [ ] Read it in `cli/src/lib/agent/settings.ts`; a malformed entry, or one naming `setup`
      or `spec`, reads as "global".
- [ ] Write it: set and clear one action's harness and one of its settings, leaving every
      other key in the file alone.
- [ ] Clear every per-action entry when the global harness is set.
- [ ] Resolve a run against its action's entry, layered over that harness's global block,
      in `cli/src/lib/agent/resolve.ts`; keep a resume on the harness it started on, and
      offer one only while that is still the action's harness.
- [ ] Fall back with a log line for an unknown name; fail with the install message for an
      uninstalled one.
- [ ] Build the run's prompt with the action's harness's skill call
      (`cli/src/lib/agent/prompts.ts` reads the global one today).
- [ ] Extend `akb agent use`, `set` and `test` to take `--action <name>`.
- [ ] Make `akb agent` print each action's harness and model, own or global.
- [ ] Carry the same fields on the agent info the command hands the UI (`AgentInfo` in
      `cli/src/lib/agent/types.ts`).
- [ ] Check a refine the watcher started, an implement a button started, and an implement
      a chat started all come up on their action's harness.
- [ ] Check a board with no per-action entry runs every action exactly as today.
- [ ] Add a "run implements on Codex" row to the table under "Driving a run" in
      `docs/guides/daily-loop.md`.
- [ ] In `kanban-ui/README.md` under "Configuration": say in "The harness" that the harness
      picked there runs every button until an action is given its own, and add the per-action
      block to the `ui.config.json` example with one line on what an absent action means.

## Decided by the agent
- **Which actions get an entry?**: every action a user can start. `setup` runs once, before
  anything is configured; `spec` is #246, which reuses this shape.
- **Does a chat follow an action's harness?**: no. A chat is a conversation on its own
  harness (#272); only a run it starts takes the action's.
- **Flag or positional for the action?**: `--action <name>`, so `akb agent set model x` keeps
  its shape. #246 should take `--agent <name>` the same way.
- **What does an action with a harness but no settings run?**: that harness's global block,
  so switching an action to Codex brings the Codex model already saved.
- **What does `akb agent set --action implement model x` do when implement has no harness
  of its own?**: it pins implement to the current global harness and saves the model under
  that entry, so a later global switch clears it with the rest.
- **Can an action override the harness's `command`?**: no. `command` stays per harness;
  an action's entry holds only the settings the harness declares.

### Worth noting
- **#246 and this card build the same machinery**: #246's "spec agents only, or every run
  kind?" question is answered by the user asking for #287. #246 should shrink to "a spec
  agent's entry reuses the per-action shape" once this lands.
- **A resume needs the action's harness, not the board's**: today `canResume` compares the
  run's harness to the global one.
