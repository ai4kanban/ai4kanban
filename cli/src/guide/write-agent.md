# Write an agent

An agent is one folder: `docs/kanban/agents/<name>/AGENT.md`. The folder name is the agent's
name and the word every flow asks for it by — lower-case words joined by `-`, matching the
`name` in its frontmatter. It cannot be a name the board already answers to: one of the
board's roles, an agent the command ships, or a folder already in `docs/kanban/agents/`.

## The file

```yaml
---
# Required; matches the folder name.
name: ux-writer
# Required: one sentence saying what it does.
description: Writes the words a screen shows.
# Optional.
akb:
  # Optional, for a preview agent: when to request it, exceptions included. Without it, it
  # always runs.
  when: A card changes what the product says to the user; not a typo.
  # Optional, for a preview agent: it runs only after these agents' previews are approved,
  # when the card requests them too; it never makes them run.
  after: [ui-designer]
  # Optional, for a preview agent: `new` runs it in a session of its own.
  session: new
---

You write the words a screen shows.
```

Its workflow, not the agent, sets its role: `WORKFLOW.md` lists it under `previews`, `land`
or `scheduled`.

A scheduled agent can also name the new input it works on; it then runs only when there is some:

```yaml
akb:
  # archived-cards | chats | dismissals; omit to run on its cadence alone.
  reads: archived-cards
```

An agent that shares material with others names the global memories it keeps:

```yaml
akb:
  # Optional; global memories under `docs/kanban/memory/<name>/`, by name.
  memory: [competitors]
  # Optional; its own memory files, or folders ending in `/`, that hold in any of the user's
  # projects. Everything else is this project's.
  memoryFiles:
    workspace: [style.md]
```

Everything under the frontmatter is the agent's instructions, read fresh on every run —
a file with none is refused.

An agent declares no options of its own. Two ways of working is two agents, each with its own
`AGENT.md` — a switch that changes how one agent works costs more than it buys.

## Translations

```yaml
akb:
  # Optional; UI text only. Runs use English; omitted text falls back to English.
  i18n:
    # Language tag; every field below is optional.
    zh:
      # Display name; does not change the agent's name.
      title: 界面文案师
      description: 撰写界面上的文字。
      when: 卡片新增或修改界面文字时。
```

## Files

Every file beside `AGENT.md`, in any subfolder, is named to the run by its path and opened only
when the work calls for it. Put long material there and keep `AGENT.md` short.

- **Scripts**: every agent owns its task scripts in its own folder, including built-in agents.
  Keep business validation there, outside the CLI's board logic. Document the runtime, inputs
  and invocation beside the script; consumers use the owner's script. Built-in files can be
  saved through `akb raw agent-file <agent> <path>` and run locally with their relative layout
  intact; custom agents use their existing folders.

## Imported skills

An agent may carry several skills, each whole in its own `skills/<skill>/` folder.

- **Keep the capability**: copy the skill's instructions, scripts, resources and license
  unchanged; never reduce it to rewritten instructions. Leave out installed packages and caches,
  and name any file it refers to that you could not get.
- **Record the source**: list each in a `## Skills` section of `AGENT.md` as
  `- **<skill>**: <when to use it>. Source: <URL or pasted> @ <commit, tag or snapshot date>`.
- **Adapt outside it**: say in `AGENT.md` when to use each skill and how its result becomes
  this agent's output; paths inside a skill resolve from its folder. Keep the skill folder
  untouched so an update can replace it whole.
- **Runtime needs**: check every command, package and credential the skill needs on this
  machine. Name what is missing under its bullet and tell the user; never call the agent usable
  while anything is missing, and never copy a key into the folder.
- **Update and remove**: update only when the user asks — replace the folder, show the diff and
  change the version. Remove a skill with its folder and bullet. Each agent owns its copies, so
  no change reaches another agent.

## Memory

`docs/kanban/memory/agents/<name>/` is read into every run. Keep none unless a user's
correction should change the agent's next output. Otherwise say in `AGENT.md`:

- **Files**: each file and what it holds; `## General` for what always holds, and a heading per
  situation (a format, a recipe, a channel) for what holds only there.
- **When**: which file to apply before which step, and which answers or corrections to record.
- **What goes in**: lasting preferences, decisions and corrections only — never raw feedback,
  run history, or what the instructions already say.
- **Shared material**: what other agents also use goes in a global memory under `akb.memory`;
  its rules arrive with every run, so `AGENT.md` never restates them.

## Output

Choose the form the reader takes in fastest and say it in `AGENT.md`: an image for a look, a
storyboard for a sequence over time, readable Markdown for everything else.

## Dependencies

- **In `after`**: name the agents whose approved previews this one needs; it waits for those
  approvals and never requests the agents.
- **In the instructions**: say what to do when the section it needs is missing or still
  carries an open question — normally draw nothing and write one line naming what is missing.
  A preview agent never asks for another.

## Instructions

Say what the agent owns, what it produces, and what it leaves alone. Don't repeat the contract
every run is already given (`akb guide spec-agent`): where the section goes, how to validate,
how to keep memory, and how to defer to the user. A scheduled agent says what one run does,
never when it runs.

## Work with the user

- **Ask little**: settle what the request, the skill and the board already answer; ask the rest
  as `akb guide update-questions` does, and never ask again what is answered.
- **State between runs**: ask how a scheduled agent should keep what its next run needs, and
  write the answer into `AGENT.md`; assume no file or format.
- **Important choices**: give a recommendation and its tradeoff, and accept a free answer.
- **Show each edit**: when changing an existing agent, show every changed file as a unified
  diff with context, followed by one sentence of reason.

## Check it

- **Validate before finishing**: after creating or editing an agent, run `akb spec`.
  Fix every problem reported for its file under "Problems on this board", then run it again.
  Do not finish until the agent is accepted with no problems reported for it.
- **`akb spec <name> <id> --print`** on a real card prints the whole prompt the agent will get:
  the contract, its instructions, the reference for each chosen setting, its files and its
  memory. Read it, and cut whatever the run does not need.
- **Workflow**: a new agent belongs to the workflow it was created in and starts switched on;
  a preview agent joins the end of that workflow's `previews`. `akb spec` refuses it while it is off.
  Switch it in Configuration → Workflows or with `akb workflow agent <workflow> --on <name>`.
- **Schedule**: set `reads` from what the agent works on; it runs automatically by default.
  Override or switch it with
  `akb workflow schedule <workflow> --on <name> --cadence <cadence|auto>`.
