---
title: Pick the model for one conversation, not for the whole board
track: features
priority: high
roi: high
status: todo
release: 0.9.0
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions: []
verify:
  - with a second coding agent installed, switch a conversation's agent in the rail — it should say what it throws away, the fresh conversation should answer on the new agent, and Configuration's own agent should be unchanged
  - type a model id that does not exist — the message should fail in the conversation with the agent's own words, and the picker should still hold what you typed
---

One agent and one model serve the whole board. Asking "what should I build next" and asking
for a hard architectural read run on the same model, and changing either changes it for
every run too.

## Worth noting
- **The agent is part of the pick**: switching it starts the conversation over, because the
  session belongs to the agent that opened it — the rail says what goes before it does it.
- **The model is typed in, not picked from a list**: a wrong id fails at the agent rather
  than in the UI, which is the price of never shipping a stale model list.
- **The pick sticks to the conversation until it is changed**: a cheap model chosen for one
  quick question keeps answering the hard one asked an hour later in the same chat.
- **Where the picker sits**: on the message box's own bottom row beside the send button,
  with the rule above the box gone, so the box reads as one surface — it costs no rail
  height, at the price of sitting further from the header that names the conversation.
- **The agent is its mark alone**: only the open list spells the harness out, which keeps
  the row short enough for the model beside it, at the cost of a name a new user has to
  open the list once to learn.

<!-- agent -->

## Today
- The model lives in `harnessSettings.<harness>.model` in `ui.config.json`, set in
  Configuration → Harness, and every run and every chat on this board uses it.
- The agent is board-wide too. A conversation held with an agent the board no longer runs
  is refused outright — "clear it to start fresh" (`blockedBy` in
  `cli/src/lib/agent/chat.ts`) — because its session id means nothing to another CLI.
- A chat records the model the agent reported (`held.model` in
  `cli/src/lib/agent/chat.ts`) but cannot choose one, and it records the agent it was held
  with (`held.harness`) only to refuse itself later.
- #342's group is giving every flow and spec agent a named runtime, and each computer the
  harness and model it runs as. A conversation has no equivalent, though it is the place a
  user most wants to switch — cheap model for the quick questions, the expensive one for
  the thinking.
- The board is harness-agnostic, so this cannot be a Claude-only `/model`: each harness
  already declares the settings it takes, and the model is one of them.

## Scope
- **An agent and model picker inside the message box**, on its bottom row beside the send
  button, showing what this conversation is running on.
- **It is that conversation's**, not the board's: the board's settings are untouched, and
  another chat is unaffected.
- **It sticks until it is changed**: every later message in this conversation uses it, and
  a new conversation starts on the board's agent and model again.
- **The board's agent and model are the default**, shown as such, and one click puts a
  conversation back to them — free for the model, and an agent switch like any other when
  the agent is what differs.
- **Switching the agent starts the conversation over**: a transcript cannot move to a CLI
  that never opened its session, so the rail says what it is about to throw away, takes the
  confirmation the bin already takes, and opens a fresh conversation on the chosen agent. A
  conversation with nothing said in it just switches.
- **Switching the model does not**: the same conversation carries on, and the next message
  runs on the new model.
- **The agent cannot be switched while a reply is coming**, refused in the words the box
  already uses. The model can be changed at any time and takes effect on the next message.
- **The picker comes from the command**, not from a list in the UI — the agents offered are
  the ones that can hold a conversation, the same set a refusal already names, and the
  model box is the picked agent's own model setting read the way Configuration reads it, so
  an agent with no model setting shows no box.
- **Free text, as elsewhere**: model ids change between agent releases, and the Harness
  section already takes a typed id for that reason. Recently used ids are offered for the
  agent that is picked.
- **The conversation says when the model changed**, so a reply can be read against the
  model that wrote it.
- **A terminal sees the same choice**: the pick travels with the transcript, so `akb chat`
  carrying on the conversation runs the same agent and model.

## Scope out
- No per-message model. The unit is the conversation.
- No model list of our own to keep fresh.
- No way to carry a conversation across to another agent — switching starts a new one.
- Nothing about runs: a run still takes the board's agent and model.

## Todo
- [ ] Let the command take an agent and a model override for one chat, and keep both with
      the transcript.
- [ ] Run a conversation on its own agent instead of refusing it when the board's differs.
- [ ] Read the picked agent's model setting and draw the model box only when it has one.
- [ ] Add the picker to the message box's bottom row, beside the send button, dropping the
      rule above the box; default to the board's agent and model, with one click back to
      them.
- [ ] Draw the agent as its mark alone in the row, and its mark and full name in the list.
- [ ] Start the conversation over when the agent is switched, behind the bin's
      confirmation and saying what goes, and refuse the switch while a reply is coming.
- [ ] Offer recently used ids beside the box, for the agent that is picked.
- [ ] Mark in the conversation where the model changed.
- [ ] Cover it in `kanban-ui/README.md` and in the Harness docs.

## By `ui-design` agent

<Mockup src=".mockups/272/a.tsx" label="In the box" />

**The picker on the box's own bottom row**, beside the send button: the agent as its mark,
the model beside it, and the way back to the board's pair. The rule above the box goes, so
the box is one surface. The agent's full name lives only in the open list.

## Decided by the agent
- **What settings does a conversation's own agent run under?**: that agent's own block on
  the board, the same settings a run on it would take, with this conversation's model on
  top. Nothing per-conversation is written into `ui.config.json`.
- **Does changing the board's agent still break a conversation?**: only one that never
  picked its own. A conversation carrying an explicit agent goes on running it; one that
  never picked follows the board and is still refused with "clear it to start fresh".
- **What if the picked agent's CLI is not installed here?**: it can still be picked, and
  the rail says it is not installed in the words it already uses for the board's agent.
  Nothing is checked before the message that fails.
