# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Connectors

- **The GLM / Z.ai route is ZCode, not Claude Code pointed at Z.ai.** The Anthropic-compatible
  endpoint provider stays for gateways like OpenRouter and LiteLLM, but no guide points it at
  Z.ai.
- **The base-URL way into GLM is not mentioned at all.** Claude Code's compatible-endpoint
  provider would reach Z.ai, but the guides stay silent about it — not even as an unsupported
  alternative. A second way into GLM in the docs splits the one answer we support.
- **A connector nobody has run a card on says so.** The guide keeps a "No card has run on it
  here" paragraph until a real card has passed on it, rather than reading like a tested
  connector's.
