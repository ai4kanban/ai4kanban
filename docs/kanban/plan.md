# Spec agents: the name comes back, memory is optional

## Decision

Rename **spec skill** back to **spec agent**, and make memory an optional field of an agent.
No third concept. No "plugin".

- **Agent, because that is what it is.** It runs in its own context, owns one section of a
  card, and now remembers. That is the commonly understood agent: Claude Code's own agent file
  is markdown with frontmatter, `memory:` optional, `skills:` optional. A skill is stateless
  instructions; the moment ours keeps taste across runs, calling it a skill is the odd word.
- **Agent without memory is native.** Omit `memory:` and it is today's stateless run. Nobody
  learns a new noun.
- **Skills stay what they are elsewhere.** `akb guide *` and the `kanban` skill are skills.
  A spec agent may one day preload one (`skills:`); not in this change.
- **No plugin.** The UI half of an agent is a contract, not code: a file the board draws,
  pointed at by a tag. Loading an agent's own React into the board is what the mockup
  renderer refuses on purpose (`react` imports only, sandboxed iframe).

```
  docs/kanban/agents/<name>/AGENT.md ─┬─ memory: project ─▶ docs/kanban/memory/agents/<name>.md
                                      │                      inlined into the run, curated by the agent,
                                      │                      one line added by the flow that hears the user
                                      └─ (no memory)      ─▶ today's run: card + note + instructions
  output ─▶ .mockups/<id>/a.{tsx,html,txt} + <Mockup> tag ─▶ card page draws it (any agent, same contract)
```

## What the board's UI already is for an agent

Nothing in `CardPage.tsx` is named for `ui-design`, but the whole mockup path is its UI half,
built into the core: the `<Mockup>` tag (`lib/mockup-tag.ts`), the renderer for `.tsx`/`.html`/
`.txt` (`lib/mockup.ts`), the full-size page (`app/mockups/[...src]`), the `.mockups/<id>/`
folder and its deletion on archive (`cli`). The plan keeps it as **the one output surface any
agent may use**: write a file under `.mockups/<id>/`, point at it with the tag, and the card
page draws it. A project agent gets the same rendering as ui-design with no board change. The
words `Mockup` and `.mockups` are not renamed now; a more general name is a later card if a
second agent actually uses the surface.

## Memory

- **Declare** — `memory: project` in `AGENT.md`. The only scope; a value other than that is
  refused with the line saying so. (Claude Code's word, so a reader guesses right.)
- **File** — `docs/kanban/memory/agents/<name>.md`, tracked in git, created empty with one
  heading on first write. Bundled and project agents use the same place. `memory/agents/` is
  reserved; `memory-init agents` is refused.
- **Read** — inlined into the spec prompt as one more `———` block. The run's "everything is
  in this message, fetch nothing" rule stands.
- **Write, two hands** — the flow that hears the user (`resolve` on an answer pointing at the
  agent's section, `revise`/`edit` on a section sent back) appends one line: what was taken,
  what was sent back, why. The agent itself, on any run, curates the file and adds what it
  learned about the product that the next run should not rediscover. Same split as
  `decisions.md` today: flows record, prune curates.
- **Prune** — `akb guide prune-memory` gains one bullet: an agent memory is taste and product
  facts, one line each, dropped once the agent's instructions say it as a rule.
- **Memory panel** — an *Agents* caption with one read-only row per file.
- **`ui-design`** declares it; **`technology-selection`** does not. A rejected dependency
  is already a module `decisions.md` line.

## OpenDesign mode for `ui-design`

A third choice of the existing **Mockup style** setting. No new setting, no UI change.

```yaml
- value: opendesign
  label: OpenDesign
  cost: a self-contained `.html` per option from the OpenDesign engine — the longest run, needs open-design installed
  reference: references/opendesign.md
```

`references/opendesign.md`, in order:

1. **Engine** — `open-design` must answer on PATH; if not, write no section and say so in the
   last message (the contract's existing "cannot answer without guessing" outcome).
2. **Design system** — use `docs/kanban/design/DESIGN.md` when present; otherwise extract one
   from the product's screens with open-design, save it there, and note in memory that it
   exists. Project state, tracked in git.
3. **Draw** — run open-design headless with the card's scope, the memory, and the design
   system; save one option per file as `docs/kanban/.mockups/<card id>/a.html`, one
   self-contained document, nothing beside it (the frame is `srcdoc`; relative files never load).
4. **Point** — the same `<Mockup src=".mockups/<id>/a.html" label="A" />` tag.

## Rename, and what it costs

- **Folder** — `docs/kanban/agents/<name>/AGENT.md` + `references/`. `docs/kanban/skills/` is
  still read for one release, each hit reported as "move it to agents/".
- **Heading** — ``## By `ui-design` agent``. A rewrite replaces either heading, so a card
  written last week is still rewritten, not doubled.
- **Settings key** — `specAgents` never changed; nothing to migrate.
- **Commands** — `akb spec <agent> <id>` and `akb raw spec-write` keep their spelling.
  `akb guide spec-skill` → `spec-agent`, old name aliased.
- **Code** — `lib/spec-skills/` → `lib/spec-agents/`, `SpecSkill*` → `SpecAgent*`,
  `SpecSkills.tsx` → `SpecAgents.tsx`, copy in `kanban-ui/i18n`, `web/i18n`, `README*.md`,
  `web/content/docs/spec-skills.mdx` → `spec-agents.mdx` with a redirect.

## Out of scope

- A plugin format, per-agent renderers, or a UI-extension API.
- `skills:` preloading on an agent; `memory: user` / `local` scopes.
- Renaming `<Mockup>` / `.mockups/`.
- Memory written by chat or propose.

## Steps

1. **Rename** — the folder, types, files and copy above; alias the old heading, folder and
   guide name. Tests in `cli/test/spec-skills.test.ts` move with it.
2. **Parse** — `memory: project` into `SpecAgent.memory`; any other value is a catalog problem.
3. **Paths** — `AGENT_MEMORY = memory/agents`; `memory-init` refuses `agents`.
4. **Prompt** — `specAgentInstructions` returns the memory text; `prompts.ts` adds the block
   and one line telling the agent it may edit that file and nothing else in `memory/`.
5. **Flows** — `resolve.md`, `revise.md`, `update-questions.md`: when to append a line to an
   agent's memory, in the same paragraph style as `decisions.md`. `prune-memory.md` bullet.
   `spec-agent.md` contract: memory is the one file outside the card you may edit.
6. **Agents** — `ui-design/AGENT.md`: `memory: project`, the `opendesign` choice, and
   `references/opendesign.md`. `technology-selection` renamed only.
7. **UI** — `readSpecAgents` carries `memory`; the Agents tile shows "remembers"; the Memory
   panel lists `memory/agents/*.md`. `kanban-ui/README.md` and the site doc each gain one
   paragraph: "Give an agent memory".
8. **Tests** — frontmatter with and without `memory`, a bad scope refused, the prompt with and
   without the file, both headings rewritten, `agents` refused as a module name.

Pre-commit: `cd cli && npm run lint`, `cd kanban-ui && pnpm typecheck && pnpm run lint`,
`cd web && pnpm typecheck && pnpm run lint`.
