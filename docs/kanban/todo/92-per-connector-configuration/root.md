---
title: "Connector setup: model, provider, endpoint, reasoning"
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [69, 80, 93, 94, 95, 96, 97]
modules: [local-ui]
questions: []
---

Today the board runs one agent and the only thing you can set is a model id. Give each
connector its own setup — who pays for the run, which endpoint it talks to, how hard the
model thinks — so someone who is not on a Claude subscription can still use the board.
This is a group task; each piece is its own subtask in this folder.

## Today
- One connector, Claude Code. One setting, the model id.
- Every run goes through whatever account the `claude` CLI is logged into. There is no way
  to say "use my API key" or "route this through OpenRouter" — not in the UI, and not by
  hand either.
- Switching connector throws away everything you typed for the old one.

## Scope
- A connector says what settings it takes, and the dialog draws them. Adding the next one —
  Codex (#69), Cursor, Openclaw — is one entry, not a UI change (#93).
- Each connector's settings are kept under its own name in `docs/kanban/ui.config.json`, so
  switching connector and switching back gets your setup again (#93).
- The board never holds an API key. A provider names the environment variable it reads, and
  the key stays in the user's own environment — `ui.config.json` is a file in their git
  repo (#94).
- Each connector ships its own list of providers, and the one you pick is what the run goes
  through. For Claude Code: the Claude subscription, the Anthropic API, or any
  Anthropic-compatible endpoint — OpenRouter, LiteLLM, a company proxy (#95).
- The Claude subscription stays the default. It only works when the user installed the
  `claude` CLI and logged in themselves, so the dialog says when it can't run — before a
  button is pressed, not after a failed run (#96).
- How hard the model thinks is one more setting, picked from a list the connector names
  (#97).
- What the user does: open Configuration, pick an agent, pick who pays for the run, type a
  model. A user who touches none of it keeps exactly today's setup.
- Order: #93 first — everything else is a setting on the list it defines. Then #94, then
  #95, which needs both. #96 checks the providers #95 adds, so it comes last. #97 can land
  any time after #93.
- Out of this group: adding Codex itself (#69), a setting per card action, and the cloud
  providers (Bedrock, Vertex, Foundry).

## Todo
- [ ] Let each connector declare its own settings #93
- [ ] Store where the API key comes from, never the key #94
- [ ] Pick which provider a connector talks to #95
- [ ] Say when a connector can't run, before a button is pressed #96
- [ ] Set how hard the model thinks #97

## Decided by the agent
- **Does #69 join this group?** No. Codex ships on its own and works with the settings we
  have today; this group works with one connector. They only need each other to be tested
  well, and `related` says that. Whichever lands second fills in the other's blanks.
- **Which providers are on the list?** The ones a user reaches for on day one: a
  subscription, the vendor's own API, and one custom endpoint that covers every gateway
  (OpenRouter, LiteLLM, a company proxy). Bedrock, Vertex and Foundry are the same kind of
  entry and can be added later without changing anything this group builds.
- **Is "OpenAI" a provider for Claude Code?** No, and the card says so instead of listing
  it. Claude Code speaks the Anthropic API only. An OpenAI model reaches it through a
  gateway that answers in the Anthropic format, which is the custom endpoint. A connector
  that speaks the OpenAI format brings its own list.
