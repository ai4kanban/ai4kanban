# Agents: roles you train, specialists you add

## Decision

The board is a team. Every flow is run by a named **agent**, every agent takes your **rule**,
some agents **remember**, and you may **add** your own where the board has a hook. Four
things, one pane, one noun.

- **Spec skill becomes spec agent.** It runs in its own context, owns one section, and now
  remembers. Claude Code's own agent file is markdown with frontmatter and optional
  `memory:`; ours reads the same. A skill is stateless instructions elsewhere.
- **Bundled flows are agents too, grouped as roles.** Planner, Builder, Reviewer on the product
  board; Writer on the marketing board. A role is a name plus the flows it runs plus the memory
  it owns. You train a role; the board runs its flows. "Training a flow" was the wrong verb.
- **Rules merge into agents.** One rule per agent, not per flow, appended to every flow that
  agent runs. The Rules pane goes away.
- **Adding is narrow and stays narrow.** A user agent plugs into one hook per board: `spec` on
  product, `write` on marketing, where it joins the bundled writer rather than replacing it.
  Propose, implement, review and land take a rule and nothing else. A second hook is a later
  card, named by a user.
- **No plugin, no multi-agent.** Nothing is orchestrated, nothing loads code. The words are
  "a team you train", and every guardrail in the CLI stays.

```
role      flows it runs                                   remembers                 add your own
────────  ──────────────────────────────────────────────  ────────────────────────  ────────────
Planner   propose create refine resolve revise            decisions rejected goal   —
          plan-release changelog archive reject setup
Builder   implement conflict run                          readme redesign modules   —
Reviewer  review                                          —                         —
Designer  spec  (ui-design, bundled)                      agents/ui-design.md       kind: spec
Architect spec  (technology-selection, bundled)           —                         kind: spec
Writer    write channel  (marketing board)                writing writing/*         kind: write
```

## The Agents pane

Replaces both the Spec skills tile and the Rules pane. A roster, then a page per row.

```
AGENTS
Planner      plans and refines cards
Builder      builds and lands them
Reviewer     checks what was built
Designer     draws the screen              ● on
Architect    picks the library             ● on
+ Add a specialist

─── Designer ────────────────────────────────────
Your rule
┌───────────────────────────────────────────────┐
│ Keep to the existing palette. No new fonts.   │
└───────────────────────────────────────────────┘
Remembers        memory/agents/ui-design.md
Mockup style     Rendered screen ▾
```

- **Row**: name, one line, a switch only on agents that may be off. Nothing else.
- **Page**: your rule, what it remembers, its settings. At most three fields; a bundled
  role without memory shows one textbox.
- **Add a specialist**: one button, no picker while the board has one hook. It creates
  `docs/kanban/agents/<name>/AGENT.md` from a template and opens it — `kind: spec` on a
  product board, `kind: write` on a marketing one. When a board has two hooks the button asks
  which, phrased as when it runs and what it writes.
- **Problems** (name clash, folder ≠ name, bad kind or memory scope) are lines on the pane,
  as the catalog reports them today.
- **Runtimes stay their own pane.** Which model plays Builder is a machine question.

## The agent file

```yaml
---
name: ui-design
description: Use when a card changes or adds a screen the user sees.   # when it is asked for
akb:
  kind: spec            # the hook: spec | write
  owns: the screen a card changes — one layout drawn by default
  memory: project       # optional; the only scope
  settings: […]         # optional; a tile on its page, as today
---
(instructions)
```

Bundled and project agents share the format and the catalog. Built-ins come first and
cannot be shadowed by name. `references/` beside the file, as today.

## Where a user agent is called

Nothing calls it directly. The run that needs it — a planning run on the product board, a
writing run on the marketing one — asks for it by name; the board starts it after that run
ends.

```
agents/<name>/AGENT.md            read fresh on every run
        ▼
refine / resolve / revise run     prompt ends with the roster: name · owns · description
                                  decides once: `akb spec <name> <id> <note>`  (records an ask)
        ▼
board, when that run ends         ask + agent on → one `spec` run, alone on the card
        ▼
the agent's run                   card + note + contract + AGENT.md + memory + your rule
                                  writes with `akb raw spec-write`, nothing else
        ▼
QA resumes on the card
```

- **Only the three plan-rewriting flows see the `spec` roster.** A spec run never does, so an
  agent cannot ask for itself. The user can force one with the same command.
- **`write` works the same way, from the writer.** A `write` agent adds to the bundled writer
  and never replaces it: the marketing build and `akb channel` carry the roster of the board's
  `write` agents and ask for one by name — `akb write <name> <id> <note>` — when one helps,
  such as an image for a blog post. The board starts it alone when that run ends. It writes
  inside `content/<id>-<slug>/` and never touches `source.md` or a channel draft; the writer
  names the file it wants in the note and links to it while writing.

## Rules

- **One file per agent**: `docs/kanban/rules/<agent>.md` — `planner.md`, `builder.md`,
  `reviewer.md`, `ui-design.md`, `writer.md`. Appended to the end of every flow that agent
  runs, after everything the board writes. A user agent's rule follows its instructions.
- **Migration**: on first read, existing `rules/<flow>.md` files concatenate into their role's
  file in flow order, then are deleted. One-time, reported in the run log.
- **Cost**: a rule meant for landing also reaches implement. The agent reading it can tell;
  no rule today needs the split.
- **Setting a rule**: `akb raw rule <agent> --file <path>`, replacing today's per-flow write.

## Memory

- **Declare** — `memory: project` in `AGENT.md`; any other value is refused with the line
  saying so.
- **File** — `docs/kanban/memory/agents/<name>.md`, tracked in git, created with one heading
  on first write. `memory/agents/` is reserved; `memory-init agents` is refused.
- **Read** — inlined into the run as one more `———` block; "fetch nothing" stands.
- **Write, two hands** — the flow that hears the user (`resolve` on an answer pointing at the
  agent's section, `revise`/`edit` on a section sent back) appends one line: what was taken,
  what was sent back, why. The agent itself, on any run, curates the file and adds what it
  learned about the product. Flows record, prune curates, as `decisions.md` today.
- **Prune** — `akb guide prune-memory` gains one bullet: an agent memory is taste and product
  facts, one line each, dropped once the agent's instructions say it as a rule.
- **Roles' memory is the files they already own.** Planner: `decisions`, `rejected`, `goal`.
  Builder: `readme`, `redesign`, `modules`. Writer: `writing.md`, `writing/*`. The page lists
  them read-only; nothing moves.
- **`ui-design`** declares it; **`technology-selection`** does not.

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
   last message.
2. **Design system** — use `docs/kanban/design/DESIGN.md` when present; otherwise extract one
   from the product's screens with open-design, save it there, note in memory that it exists.
3. **Draw** — run open-design headless with the card's scope, the memory and the design
   system; save one option per file as `docs/kanban/.mockups/<card id>/a.html`,
   self-contained, nothing beside it.
4. **Point** — the same `<Mockup src=".mockups/<id>/a.html" label="A" />` tag.

## Rename, and what it costs

- **Folder** — `docs/kanban/agents/<name>/AGENT.md`. `docs/kanban/skills/` is still read for
  one release, each hit reported as "move it to agents/".
- **Heading** — ``## By `ui-design` agent``. A rewrite replaces either heading.
- **Settings key** — `specAgents` never changed; nothing to migrate.
- **Commands** — `akb spec <agent> <id>` and `akb raw spec-write` keep their spelling.
  `akb guide spec-skill` → `spec-agent`, old name aliased.
- **Code** — `lib/spec-skills/` → `lib/agents/`, `SpecSkill*` → `SpecAgent*`,
  `SpecSkills.tsx` + `FlowRules.tsx` → `Agents.tsx`, copy in `kanban-ui/i18n`, `web/i18n`,
  `README*.md`, `web/content/docs/spec-skills.mdx` → `agents.mdx` with a redirect.

## Out of scope

- A second hook on the product board (`review`), and a hook picker, until a user names one.
- Agents on propose, implement, review, land. Rule only.
- A plugin format, per-agent renderers, a UI-extension API, `skills:` preloading,
  `memory: user` / `local`.
- Renaming `<Mockup>` / `.mockups/`. Memory written by chat or propose.
- Moving Runtimes into the Builder row.

## Steps

1. **Rename** — folder, types, files and copy above; alias the old heading, folder and guide
   name. Tests in `cli/test/spec-skills.test.ts` move with it.
2. **Roles** — `lib/agent/roles.ts`: name, one line, flows, memory files, per solution. The
   catalog returns roles first, then bundled specialists, then project agents.
3. **Rules** — `rules/<agent>.md`; `readRule(agent)` resolves a flow to its role; the one-time
   concatenation; `akb raw rule`.
4. **Parse** — `kind: spec | write`, `memory: project`; anything else is a catalog problem.
   `write` is refused on a board whose solution is not marketing.
5. **Paths** — `AGENT_MEMORY = memory/agents`; `memory-init` refuses `agents`.
6. **Prompt** — the memory block and the rule block on a spec or write run.
7. **Flows** — `resolve.md`, `revise.md`, `update-questions.md`: when to append to an agent's
   memory. `prune-memory.md` bullet. `spec-agent.md`: memory is the one file outside the
   card you may edit.
8. **Agents** — `ui-design/AGENT.md`: `memory: project`, the `opendesign` choice,
   `references/opendesign.md`. `technology-selection` renamed only.
9. **UI** — `Agents.tsx`: roster, page, Add a specialist, problems.
   Remove `FlowRules.tsx` and the Rules nav item. `kanban-ui/README.md` and the site doc each
   gain "Give an agent a rule" and "Give an agent memory".
10. **Tests** — frontmatter with and without `memory`, bad scope and bad kind refused, the
    prompt with and without memory and rule, both headings rewritten, `agents` refused as a
    module name, rule migration.
11. **Write hook** — the `write` roster on the Writer's flows; `akb write <agent> <id> <note>`
    recording an ask and started as a `spec` ask is; `guide/write-agent.md`; and when to call
    one in `marketing/implement.md` and `marketing/channel.md`.

Pre-commit: `cd cli && npm run lint`, `cd kanban-ui && pnpm typecheck && pnpm run lint`,
`cd web && pnpm typecheck && pnpm run lint`.
