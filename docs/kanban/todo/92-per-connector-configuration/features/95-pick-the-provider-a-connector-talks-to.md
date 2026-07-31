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
- There is no way to move Claude Code off its logged-in account. Not from the dialog, and
  not by hand either: for Claude Code the provider is set by environment, and the
  `command` override sets flags, never environment.

## Scope
- Each connector ships its own list of providers. The dialog shows that list as one
  setting, and the pick is what a run then goes through.
- Claude Code's list is three entries:
  - **Claude subscription** — the default. It uses the login the `claude` CLI already has,
    and needs nothing else.
  - **Anthropic API** — pay per token with a key from the environment (#94).
  - **Anthropic-compatible endpoint** — a gateway such as OpenRouter or LiteLLM, or a
    company proxy. It shows one more box, the base URL, which is required for this pick.
- Picking a provider sets the environment a run starts under. That is the only lever that
  actually moves Claude Code, so this is where it lives.
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
- [ ] Show the base URL box only for the endpoint provider, and refuse to save that pick
      with the box empty.
- [ ] Keep the Claude subscription the default, so an untouched board runs exactly as it
      does today.
- [ ] Update `kanban-ui/README.md`: the provider list, what each one needs, and that Claude
      Code only reaches an OpenAI model through an Anthropic-format gateway.
- [ ] Run a card end to end on each of the three: the subscription, a real Anthropic API
      key, and one gateway base URL.
