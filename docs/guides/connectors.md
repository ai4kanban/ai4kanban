# What each coding agent can do

The board runs your work through one coding agent — Claude Code, Codex, Cursor, OpenCode,
DeepSeek Harness or ZCode. Pick it in **Configuration → Harness**, or with
`akb agent use <name>`.

All six do the work. What differs is what they report back while they do it, and that
changes what you see. The same list appears under the agent grid in Configuration and in
`akb agent list`.

## Support

| | Claude Code | Codex | Cursor | OpenCode | DeepSeek Harness | ZCode |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Chat and resume | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Early-crash resume | ✓ | — | — | — | — | — |
| Run cost | ✓ | — | — | ✓ | ✓ | — |
| Token counts | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Model name | ✓ | — | ✓ | — | ✓ | ✓ |
| Rate-limit exit | ✓ | — | — | — | — | — |
| Direct skill call | ✓ | ✓ | — | — | — | — |

**Chat and resume** — talk to the board or a card, and pick up a failed run instead of
restarting it. Every agent supports this.

**Early-crash resume** — only Claude Code can resume a run that failed in its first seconds.
On the others, restart it. Later failures resume normally on all six.

**Run cost, token counts, model name** — what the runs panel shows for a finished run. A
blank means the agent reported nothing; the board never estimates.

**Rate-limit exit** — Claude Code ends a rate-limited run and frees the card. The others
wait the limit out, holding the card. Stop the run yourself to get the card back.

**Direct skill call** — Claude Code and Codex are told to load the board skill by name.
Cursor, OpenCode, DeepSeek Harness and ZCode are asked in the prompt instead, and may skip it.

## What a run may touch

Codex, OpenCode and DeepSeek Harness run inside a fence: they write in the project and
refuse anything outside it. Cursor and ZCode have none — their tools run without stopping
to ask, because a run has nobody at the keyboard to answer, and nothing holds them to the
project folder. Pick a fenced agent if that matters to you, or run the board in a
container.

## Settings

Each agent's fields sit under the grid. A field that isn't shown isn't sent.

| Agent | Fields |
|---|---|
| Claude Code | Provider (subscription, Anthropic API, or a compatible gateway), model, reasoning effort |
| Codex | Model, OpenAI key (optional — otherwise your `codex` login) |
| Cursor | Model, Cursor key (optional). Reasoning goes inside the model id: `claude-opus-4-8[effort=high]` |
| OpenCode | Model as `provider/model`, reasoning effort. Keys come from `opencode auth login` |
| DeepSeek Harness | Model, DeepSeek key (optional — otherwise the one `dsh` saved) |
| ZCode | Sign-in (the login ZCode has, or a Z.AI Coding Plan key), model |

Claude Code is the only one with a provider choice for gateways, so it is the one to pick
for OpenRouter or LiteLLM.

### ZCode

ZCode is Z.ai's own coding agent for its GLM models, and the way to run this board on a
GLM Coding Plan.

- **Getting the command**: `npm install -g zcode-app-cli` puts `zcode` on your PATH. It is
  a community package, not Z.ai's — it lifts the agent out of ZCode Desktop, and its own
  README says its right to republish that runtime is unconfirmed. If you would rather not
  rely on it, install ZCode Desktop and point this agent's `command` in
  `docs/kanban/ui.config.json` at the `zcode` inside it, followed by `app-server`.
- **Signing in**: leave **Sign-in** on *The login ZCode has* and run `zcode login` (macOS)
  or `/login` in `zcode` once. Otherwise pick *Z.AI Coding Plan key* and paste the key —
  from Z.ai, or from BigModel for the same plan bought in mainland China.
- **Model**: `glm-5.3`, `glm-5.2`, `glm-5.1` or `glm-5-turbo`. Empty runs whatever ZCode is
  already set to. Write `zai/glm-5.3` to name the provider as well.
- **The board's rules**: ZCode finds them in `.agents/skills/kanban/` by itself.

Press **Test** (or run `akb agent test`) to send one small message through the setup, so a
bad login turns up here rather than on your next card.

A `command` you write into `docs/kanban/ui.config.json` overrides these fields — the board
never replaces a flag you set yourself, and says so on any field it affects.
