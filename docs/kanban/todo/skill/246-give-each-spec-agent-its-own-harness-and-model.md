---
title: Give each spec agent its own harness and model
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [247]
modules: [skill]
questions:
  - question: "[user] Which settings can a spec agent override?"
    mode: single
    options:
      - harness and model only — the two the request names
      - harness, plus every setting that harness declares — provider, base URL, reasoning, command — reusing the machinery a harness already has
      - harness, model and reasoning — the three that change how hard the agent thinks
    recommend: [2]
  - question: "[user] Is this override for the spec agents only, or for every kind of run?"
    mode: single
    options:
      - spec agents only — they are the ones whose job differs from building a card
      - every run kind — implement, refine, propose and the spec agents all get one, as one per-role setting
    recommend: [1]
---

Both spec agents — `ui-design` and `technology-selection` — run on whatever harness the
board is set to, with whatever model that harness is set to. A harness is the coding tool
a run spawns: Claude Code, Codex, and the rest. But drawing a screen and comparing
libraries are not the same job as building what a card asks for, and they do not want the
same model. Let each spec agent carry its own harness and its own settings, and fall back
to the board's when it names none.

## Today
- `docs/kanban/ui.config.json` holds one harness name, and one settings block per harness
  under `harnessSettings`. That one pick runs every kind of run there is.
- A spec agent's only setting is a switch: `"specAgents": { "technology-selection": false }`,
  and an absent name means on.
- Nothing can ask a run to use a harness other than the board's. `resolveHarness()` in
  `cli/src/lib/agent/resolve.ts` can hold a run to one harness, but only to keep a resumed
  run on the harness that started it.
- So a user who wants `ui-design` on a stronger model has to switch the whole board over,
  wait for the run, and switch back.

## Scope
- **A spec agent may name its own harness**, and its own settings for that harness.
- **An agent that names none runs the board's harness**, with the board's settings, exactly
  as today.
- **One entry per agent holds both**: that agent's on/off switch and its override.
- **A file written before this still reads the same**: `"technology-selection": false`
  still means off.
- **Read once, as the spec run resolves**, so a change made mid-run reaches the next run
  and never this one.
- **Every spec run uses the agent's harness**, whether a person typed `akb spec` or a board
  flow asked for that agent by itself.
- **A harness name we do not ship falls back to the board's harness.**
- **The run's log says it fell back**, and names the harness that was asked for.
- **A harness we ship whose CLI is not installed does not fall back.**
- **That run fails with the install command in its log**, the way any run on an uninstalled
  harness fails today.
- **API keys stay in `docs/kanban/.env`** and nowhere else.
- **An agent on another harness reads that harness's key from that same file**, under the
  environment variable name that harness declares.
- **`akb agent set` can be pointed at one spec agent**, and then it offers the settings of
  the harness that agent names — the API key among them — instead of the board's.
- **An empty value clears that agent's setting** back to the board's.
- **A setting is checked against the harness that will run it**, so a value that harness
  refuses is refused at save time.
- **`akb agent test` can be pointed at one spec agent** the same way.
- **`akb spec` says what each agent will run on**: its harness and its model, and whether
  that is the board's or the agent's own.
- **The command hands a front end the same answer**: the spec agent list `akb spec` builds
  carries each agent's harness, its settings, and which of them are the board's.
- **No screen is drawn here**: this card fills those fields, and #247 draws them.
- **No other kind of run gets the override**: implement, refine and propose are unchanged.

## Todo
- [ ] Grow a `specAgents` entry so it can carry the switch, a harness name, and that
      harness's settings, with a plain boolean still meaning the switch.
- [ ] Read it in `cli/src/lib/agent/settings.ts` so a boolean still reads as the switch it
      is today, and a malformed entry still reads as "on, board's harness".
- [ ] Write it: set and clear one spec agent's harness and one of its settings, leaving
      every other key in the file alone.
- [ ] Resolve a `spec` run against that agent's entry, layered over the board's harness, in
      `cli/src/lib/agent/resolve.ts`.
- [ ] Fall back to the board's harness when the agent names one we do not ship, and put a
      line in the run's log saying so.
- [ ] Let the run fail with today's install message when the agent's harness ships but its
      CLI is not installed.
- [ ] Extend `akb agent set` so it can be pointed at one spec agent and write that agent's
      harness, its settings, and its API key.
- [ ] Check a saved setting against the agent's own harness, so a value that harness
      refuses is caught at save time.
- [ ] Extend `akb agent test` the same way, so a spec agent's harness and key can be
      checked before a card needs them.
- [ ] Make `akb spec` print each agent's harness and model beside the two lines it prints
      now.
- [ ] Carry the same fields on the spec agent list the command hands out (`SpecAgentView`
      in `cli/src/lib/agent/types.ts`), so a front end keeps no copy of its own.
- [ ] Check a `ui-design` run a board flow started, not one somebody typed, comes up on
      that agent's harness and model.
- [ ] Check a board with no override runs both agents exactly as it does today.
- [ ] Update `docs/guides/daily-loop.md` where it says a spec agent has one switch, and
      where it lists what `akb agent set` can set.

## Decided by the agent

- **How does a user set the API key for a harness only a spec agent uses?**: with the same
  `akb agent set`, pointed at that agent. A run already reads `.env` by the name its own
  harness declares, so one line in the one file is enough.
- **Does the run list need a new field?**: no. A run already records the harness and the
  model it ran under.

### Worth noting

- **A missing CLI fails the run instead of falling back**: the board's model would write a
  weaker answer into the card under that agent's name, and one install fixes it.
- **An unknown harness name still falls back**, because it can never work in this version.
- **The fallback needs a new log line**: today the board only says it fell back on the
  settings screen, and a spec run has no screen to read.
- **Save-time checking moves to the agent's harness**: today it runs against the board's,
  so resolving has to know which agent is asking, not only which run is resuming.
