---
title: Run each board action on its own harness
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [288, 289, 246, 247, 272]
modules: [skill, local-ui]
questions:
  - question: "[user] #246 gives the spec agents their own harness and #288 gives every action one, with the same machinery. Keep them as two cards, or fold #246 into #288?"
    mode: single
    options:
      - two cards — #288 builds the per-role setting first, #246 reuses its shape for the spec agents (#246 becomes blocked by #288)
      - one card — #288 also covers the spec agents; #246 is archived into it
    recommend: [1]
---

Every board run — implement, refine, resolve, edit, create, propose, archive, reject and
the rest — spawns the one harness the board is set to. A harness is the coding tool a run
spawns: Claude Code, Codex, Cursor, and the rest. Building a card and planning a card are
not the same job, and archiving one is barely a job at all; they do not all want the same
tool or the same model. Let each action carry its own harness, and keep one global harness
in the UI that resets them all. This is a group task; each piece is its own subtask in this
folder.

## Scope
- Every action the board can run may name its own harness, and its own settings for that
  harness (model, provider, and the rest that harness declares).
- An action that names none runs the global harness, exactly as today.
- The UI sets a harness per action, and keeps the global one: setting the global harness
  resets every action back to it.
- The command can read and write the same settings, so the skill can do what the UI does.
- Out: a harness per card, or per run.
- Out: the spec agents' own harness — that is #246 and #247, and it should end up reading
  the same shape of setting as an action does.
- Out: the model a chat conversation runs on — that is #272, and it is picked per
  conversation, not per action.

## Todo
- [ ] Let every board action name its own harness and settings #288
- [ ] Set each action's harness in the UI, with one global harness that resets them all #289

## Decided by the agent
- **Is "planning" one setting covering edit, refine, resolve, create and propose, or is each
  action set on its own?**: each action on its own — that is what the ask says, and an
  unused entry costs nothing. Whether the UI groups the rows is #289's call.
- **Does a chat on the board follow an action's harness?**: no. A chat is one conversation
  with its own model pick (#272); only runs the board starts take an action's harness.
