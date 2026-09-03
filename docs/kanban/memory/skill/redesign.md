# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Project memory

- ❌ **Write a note to the project-wide set *and* the module's set** → ✅ pick one copy by
  the card's modules and write only there. The root set is the umbrella project's own
  memory, not a mirror of the modules.
- ❌ **Assume one top-level folder is one module** → ✅ a module can span several folders and
  two can share one, so no code maps a file path back to a module. Only the name is
  machine-read; where it lives is prose.

## Card format

- ❌ **Leave recurring state without an in-card home** → ✅ `board create --track recurring`
  writes `Run state` and `Process`; keep next-run state on the card, and omit cadence unless
  the user explicitly asks for a schedule.
- ❌ **The agent half of a card carries a "worth noting" list** → ✅ it is a reviewer's aid
  and sits in the human half, which stands alone because the agent half is folded.
- ❌ **A `## Worth noting` bullet that states a fact** → ✅ name the cost, the tradeoff, or
  the option it beat, so a reviewer has something to reverse. The human half is written
  last, by someone who already knows the plan, so it compresses into allusion a reviewer has
  no premises for.
- ❌ **A card's state lives somewhere other than the card** → ✅ everything about a card is a
  frontmatter field the command writes and nothing else does, so the state survives a
  restart and any reader can parse it.
- ❌ **One feature split into sibling top-level cards** → ✅ a group task: a root holding the
  shared plan, ordering and spanning questions, with each piece a subtask. Siblings hide
  that they are one feature and make the same question get asked on three cards.
- ❌ **A second group for a goal an open group already carries** → ✅ read the open groups'
  roots first and add the piece as a subtask where one already aims at that outcome.
- ❌ **A card claims behavior the product already has** → ✅ scope lists only what this task
  changes; restating what already holds reads as new work.
- ❌ **A user-facing answer planned as a command only** → ✅ a card whose result the user
  would want while looking at the board says where it shows in the UI too.
- ❌ **Answer an ask the agent already fields by adding a command and a screen** → ✅ when
  the board's existing commands already return the data, the deliverable is a flow the
  command prints and the agent applies, and nothing is built.

- ❌ **Accept that a fact the board never wrote down cannot be shown** → ✅ when a view needs a
  fact the card does not carry, stamp it on the card at the moment it becomes true — an
  optional frontmatter field written only when set, the way `last_run` is. `record.csv` counts
  events for the score; it is not where a card's own facts live.

## Idea intake

- ❌ **Send an article, analysis or complaint straight to add-task** → ✅ treat it as
  evidence: extract the user problems, route them to modules, and validate them against
  shipped, planned, rejected and remembered work before creating cards.

## The command

- ❌ **Assume the command can find the board from where its own file sits** → ✅ it locates
  `docs/kanban/` from the working directory. Anything moving per-project state out of the
  skill folder has to keep that true or the plugin channel silently breaks.
- ❌ **Teach `npx <short name>` without checking npm first** → ✅ a short name is often
  already someone else's package. Check before publishing it as the way in.
- ❌ **Publish the board's bookkeeping verbs as the command a person types** → ✅ publish the
  actions the UI's buttons stand for. A published verb is a contract forever, and one that
  changes nothing a user sees earns only documentation debt.
- ❌ **Let a word mean a bookkeeping move at one layer and an agent run at another** → ✅ one
  meaning per word: archive, create and reject are agent runs that end in bookkeeping, and
  the bare move gets a different name.
- ❌ **Reuse a coding agent's own word for one of our nested things** → ✅ pick a word the
  neighbouring tool is not already using for a different lifetime. The board has three
  levels — delivery, run, session — and each keeps one name.
- ❌ **Ship the flows as reference pages copied into each project** → ✅ the command prints
  the flow for the board it was asked about, naming that project's own tracks and paths.
- ❌ **Route a flow's card edits through a board command, so the board is the only writer** →
  ✅ flows edit card bodies with their own file tools. One session per card is already
  refused and `akb board` only rewrites frontmatter, so the clobber this guards against
  costs less than a write path agents are not trained on.
- ❌ **Give an action a second mode without saying when to pick it** → ✅ a card that adds a
  mode also states the rule for choosing it, and where the agent reads that rule.

## The goal

- ❌ **Judge the goal by a rule in the code** → ✅ the agent is the only judge of how good a
  goal is; the board only sees whether text is there.
- ❌ **A goal the user just wrote stays weak until an agent re-judges it** → ✅ written but
  not judged yet is its own value, and it never nudges. Every path that writes the goal
  leaves the file in a state that doesn't ask for it again.
- ❌ **Seed a file with a paragraph explaining what belongs in it** → ✅ the file starts empty
  and the explanation sits where the user is asked for it.

## Releases

- ❌ **A release is a group task you drag work into** → ✅ a release is a field on a card, so
  an ordinary card never has to live inside someone else's folder.
- ❌ **Make the agent's judgement safe by parking it in a proposal the user accepts or
  discards** → ✅ the agent decides and writes; the log is the record, and undo is asking the
  agent to move a card back. A user who can't tell whether the proposal is right is only
  being asked to click yes.

## Score

- ❌ **Use calendar dates to divide an event record into releases** → ✅ append an ordered
  release-close boundary and calculate between boundaries; dates cannot separate two closes
  on one day.
- ❌ **Collect a score with another bookkeeping call in an agent flow** → ✅ add the evidence
  to a call the flow already makes. Measurement must not make the agent take an extra step.
- ❌ **Expose an automatic score record as an agent guide** → ✅ keep its schema and
  validation inside the CLI, and put only the facts an agent must supply in the flow that
  supplies them.

## Deliveries

- ❌ **Turn an implementation detail found by review into a card** → ✅ review fixes in-scope
  mistakes and drops unrelated discoveries; task discovery belongs to a planning flow.
- ❌ **Keep a review verdict after rebasing onto a moved target** → ✅ review the composed
  tree after every rebase or conflict resolution, so the reviewed tree is the one that lands.

## Refining on its own

- ❌ **Treat every test as "check by hand"** → ✅ put agent-executable checks in
  `## Todo`; reserve `verify:` for a reproducible human plan with its setup, action and
  expected result, and add any fixture or test seam that plan needs to the todo.
- ❌ **Record every auto-answer in `decisions.md`** → ✅ keep auto-answers on the card and
  append only a decision that helps future decision-making, so it stays a short memory.
- ❌ **An auto-refined card mixes the human's original input with the agent's additions** →
  ✅ split the card into two halves so the additions are easy to read and audit.
- ❌ **A run does its own follow-up work inside its own session** → ✅ each step is its own
  run, so the user can see it, read its log and stop it.
- ❌ **A printed flow hands over to refine without saying where it runs** → ✅ every handover
  line says "in a fresh session, not this one".
- ❌ **Infer which cards became unblocked after every run** → ✅ a rough card saves a one-shot
  refine when it first becomes blocked; finishing the blocker only makes that schedule
  eligible, and cancelling lasts for the current blocked episode.

## UI design

- ❌ **Make one drawing style the only one, and decide it for every board** → ✅ a rendered
  screen styled like the project is the default, because a drawing the user can look at
  beats one they have to decode; ASCII is the other choice, for a shorter run and a file
  that reads as itself. Which one is a board setting, not a rule.
- ❌ **Put the mockup's markup in the card body** → ✅ each mockup is its own file under a
  folder keyed by the card's id, with one short line pointing at it. Pages of markup bury
  the plan and fill the diff.
- ❌ **A mockup is plain HTML, styled by hand to look like the project** → ✅ write it in the
  stack the board UI already runs, so the file is the screen and not scaffolding around it.
  A plain `.html` page stays accepted for a screen that is not a component.

## Connectors

- ❌ **Pin the one version a connector was exercised at, and check every connector** → ✅ a
  version-sensitive connector declares the range it was exercised across, and a mature
  harness declares nothing and is never asked — a single pinned version warns on the next
  ordinary bump, and a gate on a harness that manages its own compatibility is noise.
