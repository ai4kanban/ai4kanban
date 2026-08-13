# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Project memory

- ❌ **Write a note to the board-root set *and* the module's set** → ✅ pick one copy by
  the card's modules and write only there. The root set is the umbrella project's own
  memory, not a mirror of the modules; copying module notes up buries what the root is for.
- ❌ **Assume one top-level folder is one module** → ✅ a module can span several folders
  and two modules can share one, so no code maps a file path back to a module. Only the
  module's name is machine-read; where it lives is prose, a reference for the reader.

## Card format

- ❌ **A card's state lives somewhere other than the card** (the UI's memory, a side file)
  → ✅ everything about a card is a frontmatter field the script writes and nothing else
  does, so the state survives a restart and any reader can parse it.
- ❌ **One feature split into sibling top-level cards** (a shared layer card plus one card
  per backend, wired together only by `blocked_by` / `related`) → ✅ a group task: a root
  card that holds the shared plan, the ordering, and the questions that span all the
  pieces, with each piece as a subtask in its folder. Siblings hide that they are one
  feature and make the same question get asked on three cards.
- ❌ **A card claims behavior the product already has** (a stopped run starts nothing, a
  timer keeps doing its other job) → ✅ scope lists only what this task changes. Restating
  what already holds reads as new work and grows the card past its point.

## Idea intake

- ❌ **Send an article, analysis, or complaint straight to add-task** → ✅ treat it as
  evidence, extract the user problems, route them to the right modules, and validate them
  against shipped, planned, rejected, and remembered work before creating cards.
- ❌ **Route propose, source extraction, and direct ideas separately from `SKILL.md`** →
  ✅ keep one short link in `SKILL.md`; let `add-task.md` route every card-creation request
  to the specialized reference it needs.

## The script

- ❌ **Assume the script can find the board from where its own file sits** (it can't, from
  a read-only plugin cache) → ✅ it locates `docs/kanban/` from the working directory,
  since commands run from the repo root. Anything that moves per-project state out of the
  skill folder has to keep that true or the plugin channel silently breaks.
- ❌ **Spell the command people type all day with the full project name (`ai4kanban card
  update 12`)** → ✅ the day-to-day command is short (`akb`) and the long name stays as a
  second name for it. Before teaching `npx <short name>`, check the short name on npm —
  `akb` is already someone else's package.
- ❌ **Publish the board's bookkeeping verbs as the command a person types** → ✅ publish the
  actions the UI's buttons stand for, and keep the bookkeeping as something the agent calls.
  A published verb is a contract forever, and one that changes nothing a user sees earns
  only documentation debt.
- ❌ **Let a word mean a bookkeeping move at one layer and an agent run at another** → ✅ one
  meaning per word. Archive, create and reject are agent runs that end in bookkeeping; the
  bare move gets a different name.
- ❌ **Ship the flows as reference pages copied into each project** → ✅ the command prints
  the flow for the board it was asked about, so it can name that project's own tracks,
  paths and memory files instead of describing them generically.
- ❌ **Give an action a second mode without saying when to pick it** → ✅ a card that adds a
  mode also states the rule for choosing it, and where the agent reads that rule. A mode an
  agent has to guess at is one it will use in the wrong half of the cases.

## The goal

- ❌ **Judge the goal by a rule in the code, so no agent run is needed** → ✅ the agent is
  the only judge of how good a goal is; the board only sees whether text is there. A rule
  that grades free-form prose is a rule that gets the user's own words wrong.
- ❌ **A goal the user just wrote stays weak until an agent re-judges it** → ✅ written but
  not judged yet is its own review value, and it never nudges. Every path that writes the
  goal has to leave the file in a state that doesn't ask for the goal again.
- ❌ **Seed a file with a paragraph explaining what belongs in it** → ✅ the file starts
  empty and the explanation sits where the user is asked for it. A seed is text the user
  deletes before they can start.

## Releases

- ❌ **A release is a group task you drag work into** → ✅ a release is a field on a card,
  so an ordinary card never has to live inside someone else's folder. A card that names
  no release is simply in no release.
- ❌ **Make the agent's judgement safe by parking it in a proposal the user accepts or
  discards** → ✅ the agent decides and writes; the run's log is the record, and undo is
  asking the agent to move a card back. A user who can't tell whether the proposal is
  right is only being asked to click yes.

## Auto-refine

- ❌ **Auto-refine records every auto-answer in `decisions.md`, same as the human resolve
  flow** → ✅ keep auto-answers on the card; append to `decisions.md` only a decision that
  helps future decision-making, so it stays a short memory not a dump of every answer.
- ❌ **An auto-refined card mixes the human's original input with the agent's own
  additions** → ✅ split the card into two parts — the plan, then what the agent
  decided/refined on its own — so the additions are easy to read and audit.
- ❌ **A run does its own follow-up work inside its own session** (a command writes a card,
  then refines the card it just wrote, in one long run) → ✅ each step is its own run, so
  the user can see it, read its log, and stop it.
- ❌ **Refine a blocked card like any other** → ✅ a blocked card waits; building its blocker
  often rewrites its plan. Refine it when the blocker leaves the board — finishing or
  rejecting a card refines whatever it was holding up.
