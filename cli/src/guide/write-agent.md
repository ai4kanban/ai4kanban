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
# Required: when the flow must request this agent; say here if it is not ready.
description: Use whenever a card changes what the product says to the user. Follows `ui-designer`.
# Required.
akb:
  # Required; one of `hook` or `lead`.
  # plan: called in while planning when its description applies.
  # schedule: runs unattended, whenever the board starts it.
  hook: plan
  # Optional below.
  # agent (default) | human; which half receives its section.
  # Hook: initial board setting. Lead: fixed here, no setting row.
  output: agent
---

You write the words a screen shows.
```

An agent that runs a whole stage declares `lead` in place of `hook`:

```yaml
akb:
  # plan | execute: the stage it runs.
  lead: plan
```

A `schedule` agent can also name the new input it works on; it then runs only when there is some:

```yaml
akb:
  hook: schedule
  # archived-cards | chats | dismissals; omit to run on its cadence alone.
  reads: archived-cards
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
      description: 当卡片修改产品界面文案时使用。
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

## Output

Choose the form the reader takes in fastest and say it in `AGENT.md`: an image for a look, a
storyboard for a sequence over time, readable Markdown for everything else.

## Dependencies

Nothing declares one. Say it in words, in both places:

- **In `description`**: name the agent this one follows, so the flow asks for them in order.
- **In the instructions**: say what to do when the section it needs is missing or still
  carries an open question — normally draw nothing and write one line naming what is missing.
  A spec agent never asks for another spec agent.

## Instructions

Say what the agent owns, what it produces, and what it leaves alone. Don't repeat the contract
every run is already given (`akb guide spec-agent`): where the section goes, how to validate,
how to keep memory, and how to defer to the user. A `schedule` agent says what one run does,
never when it runs.

## Work with the user

- **Ask little**: settle what the request, the skill and the board already answer; ask the rest
  as `akb guide update-questions` does, and never ask again what is answered.
- **State between runs**: ask how a `schedule` agent should keep what its next run needs, and
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
  `akb spec` refuses it while it is off. Switch it in Configuration → Workflows or with
  `akb workflow stage`.
- **Schedule**: set `reads` from what the agent works on; it runs automatically by default.
  Override or switch it with
  `akb workflow schedule <workflow> --on <name> --cadence <cadence|auto>`.
