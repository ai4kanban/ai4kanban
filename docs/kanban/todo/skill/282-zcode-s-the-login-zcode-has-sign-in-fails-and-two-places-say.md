---
title: ZCode's 'The login ZCode has' sign-in fails, and the docs say it works
track: skill
priority: high
roi: high
status: implementing
release: 0.8.0
blocked_by: []
related: [229]
modules: [skill, docs, local-ui]
questions: []
verify:
  - Run a card end to end on ZCode with a Coding Plan key after the Sign-in box is gone — the key box is the only route left, so nothing else proves it still reaches the run.
  - Configuration shows ZCode with a Model box and a key box, and no Sign-in box.
  - Clear the key box and start a run — the log ends with ZCode's own error and the board's line about the key box.
  - The board's half of the key rename is now covered by cli/test/run-env.test.ts — the end-to-end run only has to prove ZCode reads ANTHROPIC_API_KEY.
---

Picking ZCode's default sign-in, *The login ZCode has*, can leave a user unable to start at
all: the board says nothing is wrong, and the first run dies with an error about a missing
key for a provider they never chose. Four places — the connectors guide, the local UI's
README and both memory notes — tell them this is the way to sign in.

```
$ akb agent test
[error] Model provider is missing an API key: zai
```

## Worth noting
- **The option goes rather than learning to explain itself.** ZCode gets a key box and
  nothing else until someone shows a login that works. Keeping it would have meant reading
  which provider ZCode is signed in to — more machinery than a dead option is worth, and it
  would still leave the user to work out that their login is the wrong family.
- **A login may yet be reachable through the Model box**, by naming the provider the login
  belongs to — `zai-coding-plan/glm-5.3` or `bigmodel-coding-plan/glm-5.3` rather than a
  bare `glm-5.3`. Untested, and not what this card chases; it is the lead for whoever brings
  the option back.

<!-- agent -->

## Today
- `zcode-app-cli` seeds `~/.zcode/cli/config.json` from its own example on first run: one
  provider, `zai`, Anthropic-format and key-required, with `model.main` pointing at a
  `zai/…` model.
- A `zcode login` credential lands under a different provider — `zai-coding-plan` or
  `bigmodel-coding-plan` — so a run with the Model box empty asks for `zai`, finds no key,
  and stops. It was first seen on a BigModel login, but nothing in that path is specific to
  BigModel.
- Pasting a Coding Plan key into the board's key box works, and is the only route anyone
  has run.
- The key box saves to `ZAI_API_KEY` in `docs/kanban/.env` and reaches a run as
  `ANTHROPIC_API_KEY`, which is what ZCode's `zai` provider reads. That rename is `envAs` on
  the `coding-plan` provider entry, and `envAs` is a provider-only field — once the list
  goes, nothing left can say which variable a run gets the key under
  (`cli/src/lib/agent/types.ts`, `agent/resolve.ts`).
- A connector that declares no provider list still drops the variables in `providerEnv`
  before a run (`agent/resolve.ts`), so that half survives the list on its own.

## Scope
- **ZCode's Sign-in box goes.** The connector keeps its Model box and its key box, and
  offers no pick between sign-ins.
- **The key still reaches a run as `ANTHROPIC_API_KEY`** while keeping its own
  `ZAI_API_KEY` line in `docs/kanban/.env`. Sharing Claude Code's line would mean one key
  box overwriting the other.
- **A run still starts with the key box empty**, and one that stops for a missing key keeps
  ZCode's own error, which names the provider, and gains one line from the board: paste a
  Z.AI or BigModel Coding Plan key into the key box.
- **A stray key still can't ride along.** `ANTHROPIC_API_KEY` and the rest stay dropped
  from every ZCode run, though the connector no longer has a provider list.
- **Every place that says the login works is corrected**: `docs/guides/connectors.md`,
  `kanban-ui/README.md`, `docs/kanban/memory/skill/readme.md` and
  `docs/kanban/memory/local-ui/readme.md`.
- **Nothing changes for the other five agents.**

## Todo
- [x] Let a secret setting name the variable a run gets its value under, beside the `env`
      name its `docs/kanban/.env` line keeps (`cli/src/lib/agent/types.ts`,
      `agent/resolve.ts`, `agent/harnesses/check.ts`).
- [x] Drop the Sign-in setting from `cli/src/lib/agent/harnesses/zcode.ts`, keeping the key
      on `ZAI_API_KEY` in the file and on `ANTHROPIC_API_KEY` in the run.
- [x] Make a ZCode run that stops for a missing key add the board's line about the key box,
      under the error ZCode ended it with.
- [x] Rewrite the sign-in bullet and the ZCode settings row in `docs/guides/connectors.md`
      so the key is the path it teaches.
- [x] Fix the ZCode claims in `kanban-ui/README.md`: the settings table row, the **Sign-in**
      bullet, the key-box bullet and the ZCode section.
- [x] Fix the ZCode lines in `docs/kanban/memory/skill/readme.md` and
      `docs/kanban/memory/local-ui/readme.md`.

## Decided by the agent
- **Why this is not filed as a docs card**: the guide is only repeating what the board
  offers. Fixing the words while the box still offers a dead option moves the problem.
- **Why the failing message counts as part of it**: the error names `zai`, a provider the
  user never chose, which is why the dead end reads as a board fault rather than a missing
  key.
- **Is the key box required before a run starts?**: no. It stays optional, and the run that
  can't sign in is what carries the user through — refusing to start would be a second
  place holding the same rule.
- **What happens to a board that already picked a sign-in?**: nothing. A `provider` left in
  ZCode's block in `docs/kanban/ui.config.json` is ignored once the setting is gone, so
  there is no migration.
- **How the key keeps its rename once the list is gone**: the secret setting names the
  variable a run gets it under. A one-entry provider list would keep `envAs` working, but it
  would draw a pick with nothing to pick.
- **What makes the board add its line**: the error ZCode ends the run with (`Model provider
  is missing an API key: …`). Adding it to every failed ZCode run would point a wrong model
  id at the key box.
- **Why the connector keeps dropping provider variables with no provider list**: the drop
  is what stops a Claude Code key in the shell reaching `api.z.ai`, and it is independent of
  whether anything picks between providers.
