---
title: Run the board on DeepSeek Harness (dsh)
track: features
priority: med
roi: med
status: todo
release: 0.6.1
blocked_by: []
related: []
modules: [skill, local-ui]
questions:
  - "[user] Run a card end to end on dsh with a real DeepSeek key. Everything else here was proved against the real `dsh-acp` — the session opens, the model is picked, the id comes back, a resume reopens the same session, a stop ends it — but nobody on this machine has a key, so no dsh run has ever reached the model. Until one does, the last box stays unticked."
  - Does ordinary work inside the project ever raise a permission request on dsh? The board answers every request with no, on the reading that its permission preset already allows writing in the project and only a wider ask can raise one. If a real run shows dsh asking before an ordinary edit, that answer has to change to yes for anything inside the project.
---

Add DeepSeek Harness (`dsh`) as a fifth agent the board can run, so someone already paying
for DeepSeek can press Implement without a second subscription.

The four agents the board runs today are Claude Code, Codex, Cursor and OpenCode.

## The way in: ACP
dsh's own headless command (`dsh --profile headless "<task>"`) says nothing until it is
finished, and cannot carry on an earlier run — the two things every board agent must do
(`docs/kanban/memory/local-ui/decisions.md`).

dsh also speaks ACP, the Agent Client Protocol. A command that speaks it does not print a
report and exit: it keeps talking to whoever started it, both ways, for as long as it
works. The board sends it the task and answers what it asks; it sends back what it is
doing, message by message.

Two commands speak ACP for dsh, and the board starts the second one:

- `@deepseek-ai/dsh-acp`, dsh's own. As of version 0.1.0-rc.7, read on 2026-08-18, it can
  only start a new session, and it reports a message only once the message is finished.
  Neither the live log nor the resume can be built on it. When it gains both, the board
  can move to it and drop the package below.
- `@openma/deepseek-harness-acp`, written by the community; its command is `dsh-acp`. It
  sends the agent's text and thinking as they are written, reports each tool call with the
  diff it made, and reopens an earlier session with its history. It reads and writes dsh's
  own settings folder `$DSH_HOME`, so the key and the sessions are the ones dsh already
  has.

A dsh user installs both packages:
`npm install -g @deepseek-ai/dsh @openma/deepseek-harness-acp`.

## Scope
- **The board answers the agent, not only reads it**: the board's runner learns to keep
  talking to the command it started, for as long as that command runs.
- **The other four agents are left alone**: they are started, handed the prompt, and read,
  exactly as they are today.
- **The live log**: a dsh run shows its text, its thinking and its tool calls as they
  arrive, the way the other four do.
- **Resume**: a dsh run that failed or was cut off carries on in the same dsh session, with
  the history that session already holds.
- **Test connection answers for dsh**: the user finds out the setup works before running a
  card on it.
- **A dsh run writes inside the project without stopping to ask.**
- **A dsh run reaches no further into the machine than the four agents already do.**
- **The user fills in two boxes**: their DeepSeek key, and a model.
- **An empty key box still runs**: the run uses the key dsh itself saved in `$DSH_HOME`, so
  someone already set up with dsh types nothing.
- **An empty model box still runs**: dsh picks its own default.
- **The model is chosen as the run's session opens**, not typed into the command.
- **The skill reaches dsh**: it reads `.agents/skills/`, the folder `akb install` already
  writes, and its prompt asks for the board skill in the same sentence Cursor's and
  OpenCode's do.
- **Apart from the runner, dsh adds only its own three pieces**: its entry in the board's
  list of agents, its logo, and the ACP client that entry brings.
- **A change needed anywhere else is a gap in that list**: widen the list first, then add
  dsh to it.

## Todo
- [x] Check what a dsh headless run can do.
- [x] Work out how a dsh run reaches the kanban skill.
- [x] Prove the ACP way once by hand: install dsh and the bridge, start `dsh-acp`, send it
      a prompt, watch the stream, reopen the session. Note the versions it was proved on.
- [x] Teach the board's runner to answer the command it started, for a run and for Test
      connection alike, leaving the four agents that only print exactly as they are.
- [x] Add dsh to the board's list of agents (`cli/src/lib/agent/harnesses.ts`), and show a
      dsh run's log as it works.
- [x] Keep a dsh run's session, so a run that failed or was stopped carries on where it
      stopped.
- [x] Set what a dsh run may do: write inside the project without stopping to ask, and
      reach no further into the machine than the four agents already do.
- [x] Give the agent dialog dsh's two boxes — the DeepSeek key and a model — and leave
      someone already set up with dsh nothing to type.
- [x] Add dsh's logo, so it can be picked in the agent list (`kanban-ui/public/agents/`)
      and shown on the site's home diagram (`web/public/agents/`).
- [ ] Run a real card end to end on dsh — implement it, refine it, archive it — and see a
      failure and a stop on it too.
- [x] Name dsh everywhere we count our agents: `README.md`, `README-zh.md`,
      `kanban-ui/README.md`, `cli/README.md`, the agents named beside `.agents/skills/` in
      the skill pane, and the site's home diagram, download page and comparison pages in
      all five languages, the plain-markdown copies under `web/public/` included.

## Decided by the agent
- **Which way in?** ACP — the only route that both streams and resumes. Not the headless
  profile (the final answer only), not the browser app (a server of its own, and talking to
  one would change how every agent is wired), not the log file under `$DSH_HOME` (never
  named by the run, compressed, and it breaks on any release), not the Python SDK (a second
  runtime for one agent).
- **The community bridge, or our own from day one?** The bridge — it works today and
  shares `$DSH_HOME` with dsh, so nothing is set up twice. Fork it under our own name the
  day it stops keeping up with dsh.
- **Do we install dsh and run it by hand first?** Yes — the bridge is someone else's
  package, so prove it once before the connector is wired to it.
- **The runner answers the agent, or a command of our own hides that it has to?** The
  runner answers. Hiding it means the command the board starts is ours, and the agent list
  would then show dsh as installed on a machine that never had it.
- **What does the runner learn — ACP, or that a command can answer back?** The second. A
  harness now declares either a parser for a command that prints or a client for one that
  talks, and the runner branches on which. ACP lives entirely in dsh's client, so the next
  agent that answers back brings its own protocol and changes nothing else.
- **What does the board answer when dsh asks to reach outside the project?** No. Under the
  preset the command starts on, writing inside the project raises no question at all — so a
  question is dsh asking to go further than Codex or OpenCode can, and the log says it was
  refused. Nothing is left waiting for a human either way.
- **Where is the model chosen?** On the session, the moment it opens. dsh carries its model
  catalog per session, so a `--model` flag would be a second place to say it, and the box is
  the one that means anything.
- **How is a dsh run resumed?** In the same dsh session, reopened with the history it holds.
  Nothing changes on the command line — the id is said inside the conversation.
- **Is a run's tokens-and-cost number this run's own?** On a fresh session, yes. dsh counts
  both for the session, so a resumed run reports what the whole conversation has used. It is
  the agent's own number either way, and the board never adds runs together itself.
