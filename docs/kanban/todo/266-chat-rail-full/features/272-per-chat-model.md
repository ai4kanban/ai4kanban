---
title: Pick the model for one conversation, not for the whole board
track: features
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [266, 246, 247]
modules: [local-ui, skill]
questions:
  - question: "[user] Can a conversation switch harness as well as model, or only model?"
    mode: single
    options:
      - Model only. A harness switch would end the conversation, since the session id belongs to the harness that opened it.
      - Both — switching harness clears the conversation and says so.
    recommend: [1]
  - "[user] Does a chosen model stick to that conversation for good, or go back to the board's on the next message?"
---

One model setting serves the whole board. Asking "what should I build next" and asking for
a hard architectural read run on the same model, and changing it changes it for every run
too.

## Today
- The model lives in `harnessSettings.<harness>.model` in `ui.config.json`, set in
  Configuration → Harness, and every run and every chat on this board uses it.
- A chat records the model the agent reported (`held.model` in
  `cli/src/lib/agent/chat.ts`) but cannot choose one.
- #246 and #247 are giving each spec agent its own harness and model. A conversation has
  no equivalent, though it is the place a user most wants to switch — cheap model for the
  quick questions, the expensive one for the thinking.
- The board is harness-agnostic, so this cannot be a Claude-only `/model`: each harness
  already declares the settings it takes, and the model is one of them.

## Scope
- **A model picker in the rail's header**, showing what this conversation is running on.
- **It is that conversation's**, not the board's: the board's setting is untouched, and
  another chat is unaffected.
- **The board's model is the default**, shown as such, and one click puts a conversation
  back to it.
- **The picker comes from the command**, not from a list in the UI — the running harness
  declares its model setting the same way Configuration reads it, so a harness with no
  model setting shows no picker.
- **Free text, as elsewhere**: model ids change between agent releases, and the Harness
  section already takes a typed id for that reason. Recently used ids are offered.
- **The conversation says when the model changed**, so a reply can be read against the
  model that wrote it.

## Scope out
- No per-message model. The unit is the conversation.
- No model list of our own to keep fresh.
- Nothing about runs: a run still takes the board's model.

## Todo
- [ ] Let the command take a model override for one chat, and keep it with the transcript.
- [ ] Read the running harness's model setting and draw a picker only when it has one.
- [ ] Add the picker to the rail's header, defaulting to the board's model with one click
      back to it.
- [ ] Offer recently used ids beside the box.
- [ ] Mark in the conversation where the model changed.
- [ ] Cover it in `kanban-ui/README.md` and in the Harness docs.
