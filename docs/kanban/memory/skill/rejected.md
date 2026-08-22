# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Agents

- **The pi coding agent as an agent the board runs** — pi has no permission prompts and
  nothing keeps a run inside the project: it reads, writes and runs shell commands anywhere
  the user can. A container is the only fence it offers. Every agent we run stays in the
  repo, and we don't ship one that can write outside it.

- **Calling spec agents when a card is written** — the add-task flow would run `akb spec`
  and put agents on the card as it is created. Spec agents belong to refine alone: a card
  written from a one-line ask has no spec to fill in yet, and a second place to call them
  means two flows to keep in step. Refine asks; add-task doesn't.

## Chat

- **A separate flow that limits what chat may do** — the chat rail is just a kanban-skill
  session, like chatting with Claude Code. Users may run any `akb` command in it, so chat
  needs no second workflow or permission layer.

- **A chat handing the run a summary of what the conversation settled** — a chat is
  `/kanban "<prompt>"` or `/kanban <id> "<prompt>"` and nothing more; asking it to also
  decide what a run needs to know, write it up and report it back gives chat a job of its
  own. Anything that changes what gets built goes on the card, which chat already does. A
  run that starts on the wrong footing gets cancelled and started again — #266 makes
  cancelling a session possible.

## Goal

- **A fixed template for `goal.md`** — we don't pin down what the goal file must contain,
  the same way Claude Code and OpenClaw don't restrict what goes in `soul.md`. What we
  write instead is a best-practices guide in `docs/guides/` — advice the user can ignore,
  not a shape the agent enforces.

## Install

- **A per-agent install that writes each editor's own rules file** — Cursor and Windsurf
  both read the shared `.agents` folder, and install already writes the skill to
  `.agents/skills/kanban/`, so they work the day they install. No per-agent target to add.

## Outside sources

- **Built-in connectors that pull outside sources onto the board** — a recurring card or
  user prompt can supply the material to the idea-extraction flow. The missing connector
  belongs outside the open core; the skill only evaluates material it can already read.

## Planning

- **Telling the agent which cards a card is holding up** — what a card holds up is the
  same links as `blocked_by`, read backwards, and it is the weaker half: "start this first"
  is a guess about order, while "don't start this yet" is a fact. Where a chain of work
  matters, we make it a group task and let the tree show itself; the card listing carries
  `blocked_by` and nothing derived from it.
- **Grouping the cards a release plan writes** — a release is already the group: its cards
  share one goal and the board lists them together. Cards that each deliver something on
  their own gain nothing from a root card written above them.
- **A second group for planning UI cards** — getting a screen agreed before it is built is
  what the spec agents group already does: its `ui-design` agent draws the layout options.
  The one piece that was needed anyway — the skill's UI design reference — moved into that
  group. One group, not two.

- **release-completeness, a score for how right a release plan turned out** — nothing runs at
  the moment a plan is finished: a release plan is ordinary `akb board update --release` calls,
  so a card that joined on day one is indistinguishable from one added in the last week, and
  there is no roster to compare the close against. The other half — work that belonged in the
  plan and was never written down as a card — needs a person to say what the right plan would
  have been. #222 kept the three numbers that can be collected automatically.

## Questions

- **A drawing of a screen inside an open question** — a question lives in the card's
  frontmatter, which is no place for full detail. Questions stay one short line each; when a
  card needs a screen drawn, the drawing goes in the card body as a fenced `html` block, and
  the question points at it.

## Setup

- **Ending setup with a v1 and a vnext group task** — not every project plans releases on
  day one, so setup must not ask for one. The board makes a release easy to see and easy
  to create when the user wants one, and never requires it. Setup ends with the first
  tasks, not with a version split.
- **Reading a deadline from the goal and splitting decisions by it** — the board has no
  deadlines, so nothing reads a date out of `goal.md` and every settled call lands in one
  `decisions.md`. Timing may come back later as its own feature.

## Storage

- **Mirror the board to a second backend** — two live copies means two-way sync and a
  conflict story, a product of its own rather than a setting. One backend per project.
- **Move every flow off Read and Grep and onto script commands** — the script already
  lists cards and writes a card's frontmatter, which is the part that needs one owner.
  Wrapping the rest — showing a card, searching card text, writing a card body — buys
  nothing on a file board: the agent reads files well. A backend that can't be read as
  files carries that cost itself, on its own card.
