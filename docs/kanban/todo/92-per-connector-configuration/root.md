---
title: "Connector setup: model, provider, endpoint, reasoning"
track: features
priority: med
roi: high
status: ready
release: next
blocked_by: []
related: [95, 96]
modules: [local-ui]
questions: []
---

Today the board runs one agent and the only thing you can set is a model id. Give each
connector its own setup — who pays for the run, which endpoint it talks to, how hard the
model thinks — so someone who is not on a Claude subscription can set the board up in the
dialog instead of in their shell profile. This is a group task; each piece is its own
subtask in this folder.

## Today
- One connector, Claude Code. One setting, the model id.
- The dialog can't name an API key, an endpoint or a reasoning level. The only way to move
  a run off the account the `claude` CLI is logged into is to export the variables Claude
  Code reads before starting the UI server — and to restart the server to change your mind.
- A run inherits the server's whole environment. An export the user forgot about still
  decides where their runs go, and nothing on screen says so.

## Scope
- A connector says what settings it takes, and the dialog draws them. Codex has proved the
  shape; adding Cursor or Openclaw is one entry, not a UI change. Already shipped.
- `docs/kanban/ui.config.json` keeps the shape it has today: the picked connector's name
  and its settings in one block. Nothing this group adds migrates a file or stops reading a
  key someone already typed.
- A key the connector doesn't declare is left alone when the dialog saves. The board
  doesn't rewrite the user's file behind their back.
- Every key the board uses sits in one file it owns, `docs/kanban/.env`, kept out of git —
  not scattered across shell profiles and wrapper scripts. No key ever reaches
  `ui.config.json`, which is checked in (#94).
- Each connector ships its own list of providers, and the one you pick is what the run goes
  through. For Claude Code: the Claude subscription, the Anthropic API, or any
  Anthropic-compatible endpoint — OpenRouter, LiteLLM, a company proxy (#95).
- The pick decides the whole environment a run starts under: the variables the picked
  provider needs are set, and the ones only the other providers use are dropped. A leftover
  export in the user's shell can never quietly send a "Claude subscription" run through a
  gateway (#95).
- The Claude subscription is the default, and a board that already saved a key reads as the
  Anthropic API, so nobody's runs change under them. The subscription only works when the
  user installed the `claude` CLI and logged in themselves, so the dialog says when it can't
  run — before a button is pressed, not after a failed run (#96).
- How hard the model thinks is one more setting, picked from a list the connector names.
  Already shipped.
- What the user does: open Configuration, pick an agent, pick who pays for the run, type a
  model. A user who touches none of it keeps exactly today's setup.
- Order: the settings list every other piece hangs off is done, and so is the reasoning
  level. #94 next, then #95, which needs both. #96 checks the providers #95 adds, so it
  waits for #95.
- Out of this group: adding connectors themselves, a setting per card action, and the cloud
  providers (Bedrock, Vertex, Foundry). Codex already shipped separately.

## Todo
- [x] Let each connector declare its own settings #93
- [x] Keep API keys in one file, not scattered #94
- [ ] Pick which provider a connector talks to #95
- [ ] Say when a connector can't run, before a button is pressed #96
- [x] Set how hard the model thinks #97

## Decided by the agent
- **Does Codex join this group?** No. Codex shipped on its own and works with the settings
  we have today; this group works with one connector. They only needed each other to be
  tested well.
- **Which providers are on the list?** The ones a user reaches for on day one: a
  subscription, the vendor's own API, and one custom endpoint that covers every gateway
  (OpenRouter, LiteLLM, a company proxy). Bedrock, Vertex and Foundry are the same kind of
  entry and can be added later without changing anything this group builds.
- **Is "OpenAI" a provider for Claude Code?** No, and the card says so instead of listing
  it. Claude Code speaks the Anthropic API only. An OpenAI model reaches it through a
  gateway that answers in the Anthropic format, which is the custom endpoint. A connector
  that speaks the OpenAI format brings its own list.
- **Is the group still worth it, now that a user can export the variables themselves?**
  Yes. Exporting sets one account for the whole server, takes a restart to change, and says
  nothing on screen. This group puts it in the dialog, per connector, and reports whether
  each choice can run. A pluggable connector is a near-term item in `goal.md`.
- **Who wins when the user's shell already exports a provider's variable?** The pick. A
  provider sets what it needs and drops what only the others use, so what the dialog shows
  is what the run gets — nothing is inherited by accident.
- **Does the settings file change shape?** No. Every setting this group adds is one more
  key beside the model, in the block that already exists. A file written today keeps
  working untouched, so the group carries no migration and no "not in effect" notice.
