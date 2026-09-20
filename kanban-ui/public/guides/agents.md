<!-- The in-app short version of web/content/docs/agents.mdx — keep it to the keys. -->

# Write an agent

An agent is one folder: `docs/kanban/agents/<name>/AGENT.md`. The folder name is the word
every flow asks for it by, and it matches the `name` in the frontmatter.

Everything under the frontmatter is the agent's instructions, read fresh on every run.
The box under this line is one: write in it as you read.

## Keys

- **description** — when a card needs this agent, written for the flow that picks it.
- **stage** — `plan`, `execute` or `review`.
- **kind** — `spec` (default) or `lead`.
- **lead** — `true` makes a spec agent lead its stage instead of helping on it.
- **output** — `agent` (default) or `human`: which half of the card its section lands in.
  A spec agent's is a setting from here on; a lead's stays what its file says.
- **settings** — the choices you make about it on this page. Each has a `key`, a `label`,
  a `default` and its `choices`; a choice needs a `value`, a `label`, the `cost` of picking
  it, and a `reference` file in the folder, sent to the run whole when it is picked.
- **i18n** — what its lines say in another language. Drawn here only: every run is given
  the English.

## Beside the file

Anything else in the folder is opened only when the work calls for it — name it in
`AGENT.md`. What the agent remembers lives in `docs/kanban/memory/agents/<name>/`.

## Check it

A file the board cannot read is listed under the grid on this page. `akb spec <name>
<card> --print` prints the whole prompt this agent will be given. Being on disk is not
being on a workflow — a stage assigns it under Workflows, though a `plan` agent joins
Coding's planning by itself.
