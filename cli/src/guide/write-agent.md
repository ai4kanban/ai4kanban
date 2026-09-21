# Write an agent

An agent is one folder: `docs/kanban/agents/<name>/AGENT.md`. The folder name is the agent's
name and the word every flow asks for it by — lower-case words joined by `-`, matching the
`name` in its frontmatter. It cannot be a name the board already answers to: one of the
board's roles, an agent the command ships, or a folder already in `docs/kanban/agents/`.

## The file

Every comment sits on its own line: the board reads one after a value as part of the value.

```yaml
---
# Required; matches the folder name.
name: ux-writer
# Required: when the flow must request this agent; say here if it is not ready.
description: Use whenever a card changes what the product says to the user. Follows `ui-designer`.
# Required.
akb:
  # plan | execute | review; its workflow stage.
  stage: plan
  # Optional below; declaring stage is enough for a new agent.
  # Default spec: fills a spec section or reviews a delivery.
  # lead: runs a whole stage; requires plan or execute.
  kind: spec
  # Default false; true lets a spec agent lead plan or execute.
  lead: false
  # agent (default) | human; which half receives its section.
  # Spec: initial board setting. Lead: fixed here, no setting row.
  output: agent
---

You write the words a screen shows.
```

Everything under the frontmatter is the agent's instructions, read fresh on every run —
a file with none is refused.

## Settings

```yaml
akb:
  # Optional; UI choices for this agent. Default none.
  # Every setting/choice field below is required except help.
  settings:
    # Unique; not enabled, runtime or output.
    - key: mockupStyle
      # UI label.
      label: Mockup style
      # Optional one-line guidance under the label.
      help: Choose a format.
      # Must match one of this setting's choice values.
      default: full
      # At least one choice.
      choices:
        # Unique within this setting.
        - value: full
          label: Rendered screen
          # The choice's tradeoff.
          cost: true to the real UI, slower to draw
          # Existing file inside this agent's folder; sent whole when selected.
          # Keep choice-specific instructions here and shared ones in AGENT.md.
          reference: references/rendered-screen.md
```

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
      settings:
        # Existing setting key.
        mockupStyle:
          label: 原型样式
          help: 选择格式。
          choices:
            # Existing choice value.
            full:
              label: 渲染页面
              cost: 与真实界面一致，画得慢
```

## Files

Every file beside `AGENT.md`, in any subfolder, is named to the run by its path and opened only
when the work calls for it. Put long material there and keep `AGENT.md` short. A file a
choice's `reference` names is not offered this way.

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
how to keep memory, and how to defer to the user.

## Work with the user

- **Ask little**: settle what the request, the skill and the board already answer; ask the rest
  as `akb guide update-questions` does, and never ask again what is answered.
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
- **Assign it**: being on disk is not being on a workflow — `akb spec` refuses the card until
  a stage has the agent. Assign it in the board UI under Configuration → Workflows. A `plan`
  agent joins Coding's planning by itself, until that board picks its helpers by hand.
