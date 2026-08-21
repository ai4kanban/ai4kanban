---
title: Run the board on ZCode, Z.ai's GLM coding agent
track: features
priority: low
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [skill, local-ui, docs, site]
questions:
  - question: "[user] Is a ZCode connector worth building, when a GLM Coding Plan already runs on the board today through Claude Code pointed at https://api.z.ai/api/anthropic?"
    mode: single
    options:
      - Build it — ZCode is Z.ai's own harness with its own goals, tools and plan quota; the endpoint route only borrows the models, and a Chinese-market user expects to see ZCode in the agent grid
      - Don't build it — write the endpoint route into docs/guides/connectors.md instead, and revisit if users ask for ZCode by name
      - Both — publish the endpoint route now, and build the connector only after ZCode ships a headless command we can rely on
    recommend: [1]
  - question: Which way in?
    mode: single
    options:
      - "The unofficial terminal client zcode-app-cli (command `zcode`, --prompt for one-shot) — the dsh route: prove it by hand first"
      - ZCode Desktop's bundled agent runtime, driven directly
      - ACP, if ZCode or a bridge speaks it
      - Wait — build nothing until Z.ai ships an official headless command
    recommend: [1]
  - question: What if a zcode run can't stream its log or resume a stopped session — the two things every board agent must do?
    mode: single
    options:
      - Drop the card and say why; the bar doesn't bend for one agent
      - Ship it anyway, with the gaps shown in the agent grid the way missing cost already is
      - Write and maintain a bridge of our own, as the community did for dsh
    recommend: [1]
---

Add ZCode as a sixth agent the board can run, so someone on a GLM Coding Plan can press
Implement on the harness Z.ai built for it.

The five agents today are Claude Code, Codex, Cursor, OpenCode and DeepSeek Harness.

## What ZCode is
Z.ai's own coding agent for GLM-5.2, launched June 2026. It ships as a desktop app, not a
command: an agent runtime with its own tool set, a **Goal** mode for multi-step work, and a
plan quota (Lite / Pro / Max) separate from per-token API billing.

Two things follow, and both need checking before anything is built:

- **There is no official headless command.** The published product is the desktop app. The
  way in today is `zcode-app-cli` — an unofficial terminal client that unpacks ZCode's own
  agent runtime and runs it as a child process. `npm install -g zcode-app-cli`, command
  `zcode`, one-shot with `--prompt "…"`. It streams the runtime's session events and carries
  `/model` and `/resume`. Whether either is machine-readable from a headless run is unknown.
- **GLM already runs on this board.** Z.ai answers on an Anthropic-compatible endpoint
  (`https://api.z.ai/api/anthropic`), so Claude Code's **Anthropic-compatible endpoint**
  provider reaches a GLM Coding Plan today, with no new code. A ZCode connector is worth
  building only for what that route does not give: ZCode's own runtime, tools and goals.
  See Pushback.

## The bar
Unchanged, and this card does not bend it (`docs/kanban/memory/local-ui/decisions.md`): the
board starts a command and reads it. An agent ships when it **streams its log as it works**
and **resumes a run that stopped short**. An agent that only prints a summary at the end is
not offered.

## Scope
- **Find out what a headless `zcode` run can actually do** — before any connector code.
  Machine-readable stream, resume by session id, exit codes, what it reports.
- **The board's runner is left alone** unless ZCode needs something the harness list cannot
  already describe. If it does, widen the list first, then add ZCode through it.
- **ZCode adds only its own pieces**: its entry in `cli/src/lib/agent/harnesses.ts`, its
  logo, and whatever parses its output.
- **The live log**: a ZCode run shows its text, thinking and tool calls as they arrive.
- **Resume**: a failed or stopped ZCode run carries on in the same ZCode session.
- **Test connection works for ZCode**, so a bad setup turns up before a card is spent on it.
- **A ZCode run writes inside the project without stopping to ask**, and reaches no further
  into the machine than Codex already does.
- **The user fills in a model and a key**, and an empty box still runs on what ZCode itself
  saved. Which auth ZCode takes — OAuth, a Coding Plan key, a Z.ai API key — decides the
  boxes.
- **A ZCode run is told to use the board skill** in the same sentence Cursor, OpenCode and
  dsh get, unless it has a direct skill call.
- **The install line is one a new user can follow and get a working run from** — proved on a
  machine that had neither ZCode nor the CLI. #235 is what happens when it isn't.
- **`reports` says only what a ZCode run really returns** — cost, tokens, model. A blank is
  fine; an invented number is not.

## Todo
- [ ] Install ZCode and `zcode-app-cli`, and check by hand what a headless run gives:
      stream, resume, model pick, auth, exit codes, cost and token counts. Note the versions
      and the date.
- [ ] Settle the way in from that (question 2), and drop the card if the bar is not met
      (question 3).
- [ ] Add ZCode to `cli/src/lib/agent/harnesses.ts` — command, flags, settings, `reports`,
      install line — and show its log as it works.
- [ ] Keep a ZCode run's session, so a run that failed or was stopped carries on.
- [ ] Set what a ZCode run may do: write inside the project without asking, no further out
      than Codex.
- [ ] Give the agent dialog ZCode's boxes, and leave someone already set up with ZCode
      nothing to type.
- [ ] Add ZCode's logo to `kanban-ui/public/agents/` and `web/public/agents/`.
- [ ] Run a real card end to end on ZCode — implement, refine, archive — plus a failure, a
      stop and a resume.
- [ ] Add the ZCode column and its settings row to `docs/guides/connectors.md`.
- [ ] Name ZCode everywhere the agents are counted: `README.md`, `README-zh.md`,
      `kanban-ui/README.md`, `cli/README.md`, the agents named beside `.agents/skills/` in
      the skill pane, and the site's home diagram, download and comparison pages in all five
      languages, the plain-markdown copies under `web/public/` included.

## Pushback
The cheapest version of "support GLM" is already shipped and undocumented: Claude Code,
provider **Anthropic-compatible endpoint**, base URL `https://api.z.ai/api/anthropic`, the
Coding Plan key. That is one paragraph in `docs/guides/connectors.md`, not a connector.

A sixth connector is a real cost — a logo in two places, a row in the support grid, five
languages of site copy, and one more agent to keep working on every release — and ZCode is
the first candidate that has no official headless command at all, so the runtime it drives
is one an unofficial package unpacks. Question 1 is whether that trade is worth taking now.
