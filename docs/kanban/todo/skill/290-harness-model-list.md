---
title: Ask each harness for its model list instead of a free-text box
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [288, 246, 272]
modules: [skill]
questions:
  - question: "[user] Claude Code's CLI has no list command. May the board itself call Anthropic's /v1/models when the Anthropic API provider is picked?"
    mode: single
    options:
      - No — Claude Code keeps the typed box. A key only ever goes to the agent's own CLI, so the default agent gains no list from this card.
      - Yes — with a key in the API key box, ask api.anthropic.com and offer what it answers. The subscription and the gateway keep the box either way.
    recommend: [1]
---

Typing a model id from memory is how a run fails on a typo. Every harness that can say
which models it will accept should hand the board that list, so the model setting can be
picked instead of typed. A harness pointed at somebody's own gateway can't know, and there
the box stays a box.

## Today
- Every harness declares `model` as `kind: 'text'` in `cli/src/lib/agent/harnesses.ts`, with
  a placeholder and the line "A wrong id fails the run; the log says why."
- `kind: 'select'` already exists and already carries `choices` (Claude Code's reasoning
  effort uses it), and `agentInfo` already hands a front end every setting a harness takes.
- Nothing anywhere asks a harness's CLI what it can run.

## Scope
- **A harness may declare how to list the models it will run.** One that declares nothing
  keeps the box it has today.
- **The list is that harness's own answer**, read from its CLI or from the session it
  opens — never a list of model ids written into our source, which goes stale the week a
  model ships.
- **What each shipped harness answers with:**
  - **cursor-agent**: `cursor-agent --list-models`, one `id - Readable name` per line under
    an "Available models" header.
  - **opencode**: `opencode models`, one `provider/model` per line, with no readable names.
  - **Codex**: `codex debug models`, a JSON catalog. Take the entries whose `visibility` is
    `list`, and use each one's `slug` and `display_name`. A Codex without that command is a
    harness with no list.
  - **ZCode**: the reply to `session/create` already carries `settings.model.available`,
    each entry holding a `ref` of `providerId` and `modelId` and a readable `label`. ZCode
    is not ACP — it speaks its own protocol, in `cli/src/lib/agent/zcode.ts`.
  - **DeepSeek Harness**: the ACP session's `configOptions` carries a `model` option whose
    `options` are the list; `cli/src/lib/agent/acp.ts` reads `currentValue` today and
    ignores the rest. `dsh-acp` leaves the option out when it has fewer than two models,
    and that is a harness with no list.
  - **Claude Code**: its CLI has no list command — see the open question.
- **An entry is a model id, and a readable name where the harness gives one.** The id is
  what a run uses.
- **The provider decides whether there is a list at all**: a harness pointed at a custom
  endpoint or base URL is not asked, and its model setting stays free text with the help
  line it has today.
- **Reading a list leaves no conversation behind.** A session opened to read ZCode's or
  dsh's models is closed, and does not join that agent's own session history.
- **A model list never carries a key anywhere but to that harness's own CLI.**
- **Typing an id the list doesn't have still works.** The list is an offer, not a rule: a
  model that shipped this morning must still be runnable today, and a value already in
  `ui.config.json` is never dropped or rewritten because the list disagrees.
- **A list that can't be read is not an error the user has to clear**: the setting falls
  back to a plain box, and says in one line that the models couldn't be read.
- **Nothing waits for a read.** Reading the board's settings, drawing a card, and starting a
  run all serve whatever answer is already cached.
- **The cache outlives the process.** `akb` is a fresh process on every command, so the
  answer is kept on disk under `docs/kanban/`, out of git.
- **The cache is keyed by harness and provider**, so switching provider doesn't show the
  other one's models.
- **A stale answer is served, then refreshed.** An answer older than a day is refreshed
  after it has been handed over, and a refresh that fails keeps the last good answer.
- **A read that doesn't answer counts as no list**, and leaves no child process running.
- **`akb agent models [--harness <name>]` prints the list**, reading it fresh rather than
  serving the cache, and prints the reason when there isn't one.
- **The agent info the command hands a front end carries the cached list**, and whether the
  last read worked (`AgentInfo` in `cli/src/lib/agent/types.ts`).
- Out: choosing the model per action (#288) or per chat (#272) — this card settles what a
  model field offers, wherever that field is drawn.
- Out: the UI for it, and `kanban-ui/README.md` — both are #291.
- Out: reasoning effort, provider, and every other setting.

## Todo
- [ ] Add an optional "list the models" declaration to `Harness` in
      `cli/src/lib/agent/harnesses.ts`, next to `settings`.
- [ ] Implement it for cursor-agent (`--list-models`), opencode (`opencode models`) and
      Codex (`codex debug models`, the entries marked `visibility: "list"`).
- [ ] Read `settings.model.available` from the `session/create` reply in
      `cli/src/lib/agent/zcode.ts`, and close the session that read opened.
- [ ] Read the `options` of the ACP `model` config option in `cli/src/lib/agent/acp.ts` for
      dsh, and treat a missing option as no list.
- [ ] Settle Claude Code from the open question below, and implement whichever way is
      decided.
- [ ] Skip the read, keeping the free-text box, when the picked provider is a custom
      endpoint or base URL.
- [ ] Cache the answer on disk under `docs/kanban/`, keyed by harness and provider, and add
      its line to the board's own `.gitignore`.
- [ ] Serve the cache without blocking, refresh a day-old answer after serving it, and keep
      the last good answer when a refresh fails.
- [ ] Give every read a time limit, and leave no child process behind when one fails or
      times out.
- [ ] Add `akb agent models [--harness <name>]`, printing the list or the reason there
      isn't one.
- [ ] Carry the cached list, and whether the last read worked, on `AgentInfo` in
      `cli/src/lib/agent/types.ts`.
- [ ] Keep a hand-written model id in `ui.config.json` working and unchanged when it is not
      on the list.
- [ ] Check a harness whose CLI is not installed, and one pointed at a dead endpoint, both
      leave a working box rather than an error.
- [ ] Update the harness table in `docs/guides/connectors.md` where it says the model is
      typed.

## Decided by the agent
- **Does Codex have a list?** Yes — `codex debug models` renders its catalog as JSON. Run
  here it answered with 8 models, 6 of them marked `visibility: "list"`.
- **Does ZCode?** Yes, and at no extra cost: the reply that opens a session already carries
  the models that login can run.
- **Is ZCode reached through ACP, as the card said?** No. dsh is; ZCode speaks its own
  protocol and has no model-listing method at all — the session reply is the only source.
- **Is a gateway asked for its models?** No. It keeps the box.
- **How stale may a cached list be?** A day.

### Worth noting
- Codex's answer comes from a `debug` subcommand, which is not a documented interface and
  could be dropped in a release. A Codex without it reads as a harness with no list, which
  is the same path a missing CLI already takes.
- Codex's JSON runs to about 300 KB, nearly all of it the models' own system prompts. Only
  the id and the readable name are kept.
- A day, rather than once per board session or only when the user asks. Short enough for a
  model that shipped this week, long enough that the board isn't spawning CLIs all day.
- A gateway is not probed for `/v1/models`, even though most answer it. One wrong guess
  against somebody's proxy sends their key to an endpoint the board never said it would
  call, for a list it can't trust.
- `kanban-ui/README.md` is left to #291. That card changes the field the README describes,
  so the sentence should be rewritten once, there.
