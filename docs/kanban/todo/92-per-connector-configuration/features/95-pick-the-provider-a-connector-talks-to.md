---
title: Pick which provider a connector talks to
track: features
priority: med
roi: high
status: todo
blocked_by: [93, 94]
related: [92]
modules: [local-ui]
questions: []
---

Every run goes through whatever account the agent's own CLI is logged into. Let the user
say who pays for a run instead — a subscription, an API key, or a gateway — so someone
without a Claude subscription can use the board.

## Today
- Nothing in the dialog moves Claude Code off its logged-in account. The provider is set by
  environment, and the `command` override sets flags, never environment.
- The only way left is to export the variables yourself before starting the UI server,
  which the server then passes to every run. That is one account for the whole board, it
  takes a restart to change, and the dialog never shows what it is.

## Scope
- Each connector ships its own list of providers. The dialog shows that list as one
  setting, and the pick is what a run then goes through.
- Claude Code's list is three entries:
  - **Claude subscription** — the default. It uses the login the `claude` CLI already has,
    and needs nothing else.
  - **Anthropic API** — pay per token with the key from `docs/kanban/.env` (#94).
  - **Anthropic-compatible endpoint** — a gateway such as OpenRouter or LiteLLM, or a
    company proxy. It shows one more box, the base URL, which is required for this pick.
- Picking a provider sets the environment a run starts under. That is the only lever that
  actually moves Claude Code, so this is where it lives.
- The pick decides that environment whole. The variables the picked provider needs are set,
  and the ones only the other providers use are dropped from the run. Otherwise a base URL
  the user exported months ago would still send a "Claude subscription" run through a
  gateway, with the dialog saying otherwise.
- Say what a connector can reach, plainly. Claude Code speaks the Anthropic API only, so
  "OpenAI" is not on its list — an OpenAI model reaches it through a gateway that answers
  in the Anthropic format, which is the endpoint entry. A connector that speaks the OpenAI
  format brings its own list when it lands (#69).
- The subscription stays the default. A user who changes nothing sees no change.
- The base URL box is shown only for the endpoint entry, so a user who picks the
  subscription never meets it.
- Amazon Bedrock, Google Vertex and Microsoft Foundry are out of scope. They are more
  entries on the same list; add them when someone asks.

## Todo
- [ ] Let a connector declare a provider list, and show it as a setting in the
      Configuration dialog.
- [ ] Give Claude Code its three providers, and start a run under the environment the
      picked one needs.
- [ ] Drop the other providers' variables from a run, so nothing the user exported in their
      shell overrides the pick.
- [ ] Show the base URL box only for the endpoint provider, and refuse to save that pick
      with the box empty.
- [ ] Keep the Claude subscription the default, so an untouched board runs exactly as it
      does today.
- [ ] Update `kanban-ui/README.md`: the provider list, what each one needs, and that Claude
      Code only reaches an OpenAI model through an Anthropic-format gateway.
- [ ] Run a card end to end on each of the three: the subscription, a real Anthropic API
      key, and one gateway base URL.
- [ ] Export a gateway base URL in the shell, start the server, pick the subscription, and
      check the run goes to the subscription.
