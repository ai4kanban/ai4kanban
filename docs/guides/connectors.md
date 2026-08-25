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
| Run cost | ✓ | ✓ | — | ✓ | ✓ | — |
| Token counts | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Model name | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Rate-limit exit | ✓ | — | — | — | — | — |
| Direct skill call | ✓ | ✓ | — | — | — | — |

**Chat and resume** — talk to the board or a card, and pick up a failed run instead of
restarting it. A resume picks the coding agent's own session back up — the conversation it
was having, with everything it had already read — while the board counts the work as a
fresh run. Every agent supports this.

**Early-crash resume** — only Claude Code can resume a run that failed in its first seconds.
On the others, restart it. Later failures resume normally on all six.

**Run cost, token counts, model name** — what the runs panel shows for a finished run. A
blank means nothing was reported and nothing could be worked out.

A cost is always an estimate, never a bill: the agent's own arithmetic where it does that
one, and the run's tokens at the model's published rate where the board does. Codex prices
nothing, so the board prices it — and shows no cost for a model whose rates it doesn't
know, which is any local model and most gateways. A run on a subscription still shows a
number, though nothing was charged for it.

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

Codex's model and cost are read from the session files it keeps under `~/.codex`, because
its own output names neither. A `command` that adds `--ephemeral` stops it writing them,
and both go blank.

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

#### Which Coding Plan to buy

A GLM Coding Plan is sold in three tiers. All of them reach the same models — the tier
buys quota, not a better model. Quota is spent as credits, on two clocks at once: a
5-hour allowance that refreshes as it ages, and a weekly one that resets every 7 days.
A run stops when either runs out.

| Tier | Credits per 5 hours | Credits per week |
| --- | --- | --- |
| Lite | 2,000 | 10,000 |
| Pro | 12,000 | 60,000 |
| Max | 28,000 | 140,000 |

Every tier reaches GLM-5.3, GLM-5-Turbo and GLM-4.7. Asking for GLM-5.2 or GLM-5.1 on a
Coding Plan gets you GLM-5.3 — the older names still work, they just don't get you an
older model.

The plan sold through [BigModel](https://bigmodel.cn/glm-coding), Z.ai's mainland-China
storefront, lists the same three tiers with the same credits and the same models. A key
from either one goes in the same box.

Tiers and quotas change. [Z.ai's plan page](https://z.ai/subscribe) and BigModel's are the
current list; the table above is a snapshot.

**Untested here.** The tier table is copied from Z.ai's and BigModel's own documentation —
no one has watched a run exhaust each tier to confirm the numbers. What has been run: a
BigModel-bought Coding Plan key drives cards end to end. A Z.ai-bought key has not been
tried, and neither has GLM-4.7. `akb resume` does not work on ZCode — a resumed run is
refused with a message about the model no longer being available — so a run that stops
partway has to be started again.

Press **Test** (or run `akb agent test`) to send one small message through the setup, so a
bad login turns up here rather than on your next card.

A `command` you write into `docs/kanban/ui.config.json` overrides these fields — the board
never replaces a flag you set yourself, and says so on any field it affects.
