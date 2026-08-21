# What each coding agent can do

The board runs your work through one coding agent — Claude Code, Codex, Cursor, OpenCode or
DeepSeek Harness. Pick it in **Configuration → Harness**, or with `akb agent use <name>`.

All five do the work. What differs is what they report back while they do it, and that
changes what you see. The same list appears under the agent grid in Configuration and in
`akb agent list`.

## Support

| | Claude Code | Codex | Cursor | OpenCode | DeepSeek Harness |
|---|:---:|:---:|:---:|:---:|:---:|
| Chat and resume | ✓ | ✓ | ✓ | ✓ | ✓ |
| Early-crash resume | ✓ | — | — | — | — |
| Run cost | ✓ | — | — | ✓ | ✓ |
| Token counts | ✓ | ✓ | — | ✓ | ✓ |
| Model name | ✓ | — | ✓ | — | ✓ |
| Rate-limit exit | ✓ | — | — | — | — |
| Direct skill call | ✓ | ✓ | — | — | — |

**Chat and resume** — talk to the board or a card, and pick up a failed run instead of
restarting it. Every agent supports this.

**Early-crash resume** — only Claude Code can resume a run that failed in its first seconds.
On the others, restart it. Later failures resume normally on all five.

**Run cost, token counts, model name** — what the runs panel shows for a finished run. A
blank means the agent reported nothing; the board never estimates.

**Rate-limit exit** — Claude Code ends a rate-limited run and frees the card. The others
wait the limit out, holding the card. Stop the run yourself to get the card back.

**Direct skill call** — Claude Code and Codex are told to load the board skill by name.
Cursor, OpenCode and DeepSeek Harness are asked in the prompt instead, and may skip it.

## Settings

Each agent's fields sit under the grid. A field that isn't shown isn't sent.

| Agent | Fields |
|---|---|
| Claude Code | Provider (subscription, Anthropic API, or a compatible gateway), model, reasoning effort |
| Codex | Model, OpenAI key (optional — otherwise your `codex` login) |
| Cursor | Model, Cursor key (optional). Reasoning goes inside the model id: `claude-opus-4-8[effort=high]` |
| OpenCode | Model as `provider/model`, reasoning effort. Keys come from `opencode auth login` |
| DeepSeek Harness | Model, DeepSeek key (optional — otherwise the one `dsh` saved) |

Claude Code is the only one with a provider choice, so it is the one to pick for a gateway
such as OpenRouter or LiteLLM.

Press **Test** (or run `akb agent test`) to send one small message through the setup, so a
bad login turns up here rather than on your next card.

A `command` you write into `docs/kanban/ui.config.json` overrides these fields — the board
never replaces a flag you set yourself, and says so on any field it affects.
