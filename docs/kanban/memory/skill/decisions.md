# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## The memory set

- The set is four files, plus `goal.md` outside it at the project level. There is no
  `archive.md`: a file nothing writes is exactly the leftover we avoid, and what shipped is
  recorded in the published docs with a `readme.md` line pointing at them.
- What the agent decided by itself stays on the card, in its own section, so the user can
  check it. Only a call a future card would need reaches `decisions.md`.
- A finished card moves to `.archive/` beside `todo/` and stays in git, so finished work can
  be read and diffed; a rejected card is still deleted, since `rejected.md` records why. The
  archive is not project memory — no flow reads it.

## The goal

- The agent judges only whether a goal is there, never the prose: missing or seed text is
  `weak`, anything the user wrote is at least `good`. Nagging about a goal the user did
  write is worse than no nag.
- What a good goal contains is advice in a guide setup links to. Nothing enforces it and the
  file stays free-form.

## Setup

- Setup asks the user for one thing, the goal. It settles what the goal answers into
  `decisions.md` and hands every call it can't settle over as `[user]` questions on one card
  that tops the board — never in the checklist, never in `decisions.md`.
- Without a written `goal.md` setup stops at the goal step: nothing after it can be built
  from seed text, so there are no decisions, no module map and no first cards.
- The module map comes after the decisions — a project started without code has no code to
  read a map from.
- Setup ends after creating 3 initial cards, the foundations later work builds on. Their
  refinement runs continue independently in the background.
- Setup is a bounded bootstrap: one repository scan, at most 5 high-level decisions and 5
  modules, and seed cards without full plans. Background refinement does the deeper work.
- While `setup-checklist.md` is there no flow creates a card; the last tick deletes it and a
  finished checklist is never kept as a record. A card the user writes by hand is never
  blocked.

## The module map

- Be conservative, above all in a from-scratch repo — a simple single-purpose project is one
  module, not several. Add lines only as the code grows.
- Adding a module later moves the notes now clearly its own out of the memory they came
  from, once. A rename keeps the memory with the module; deleting one folds its memory back
  into the project-wide set.

## Refining on its own

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it is sure of and ends either `ready` or holding only the questions a human must
  answer.
- Creation and refinement keep a hard context boundary: creation distills the request into a
  self-contained card, and refinement starts fresh and tests that card on its own. Context
  the card failed to preserve is a creation defect.
- A card is refined as soon as a run creates it — every action that used to follow nothing
  starts a refine on the cards it created, and none on the cards it merely edited.

## Implementation runs

- Minor direct-to-target, no-commit execution is limited to interactive in-session work;
  background runs retain delivery tracking and landing semantics.

## Open questions

- A question can carry options — `single-option` to pick one, `multi-options` for as many as
  you want — and one with no options stays an open-ended ask. A question written as prose
  with the choices inside keeps working and is never rewritten; no card is migrated.
- No flow puts a human in the loop while it works. Anything it cannot settle is left on the
  card as an open question and the run finishes; the card is where the user answers, at the
  time they choose.

## Recurring tasks

- A built-in background job ships as a seeded card in the recurring track, run when the user
  sets a cadence — never as its own UI switch with its own state file. The card is the
  visible, editable record; deleting it is the opt-out, and nothing re-adds it.
- A cadence is always the units grammar — `30m`, `2h`, `1d`, `1d at 09:30`. There is no word
  form like `daily`, so nothing has to translate between two.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the release
  off the cards still open; they are never moved into the release afterwards.
- The open releases are one line each in `docs/kanban/releases.md`, in ship order, holding
  only what is still ahead — short enough that reordering and renaming are hand edits.
- A version id is letters, numbers, dot, dash and underscore, kept as typed. A card with no
  release has an empty field, and there is no sentinel name for that state.
- A card naming a release that is not on the list keeps it and `release list` names the id,
  so it can be put back; setting a release the list doesn't have is still an error, so a
  typo can't invent a version.
- A release with a goal is filled by an agent run that judges each open card on whether it
  ships the goal and writes what the board hasn't got. One with **no** goal keeps the plain
  predictable rule: high-priority cards in no release, unblocked, not a group root.
- Filling only ever adds — a card already in another release is left alone — so it can be
  run as often as the goal changes, and taking a card back out is the user's move.

## The command

- One command owns every board and agent action, and the skill shrinks to a short note
  pointing at it. The UI drives its runs through the same command, so there is one
  implementation of every move rather than one per surface.
- What we teach a person is the actions the UI's buttons stand for. The board's own
  bookkeeping stays a command the agent calls and stays out of the README.
- The command is a Node program, not a compiled binary: everything the board runs on already
  carries Node, so a binary would remove no dependency and would add six signed builds per
  release. The desktop app runs it under Electron's own Node.
- `akb` typed alone opens the app when the app installed it — the same command is the CLI
  when given an action, the way `cursor` works. The npm copy prints help.
- On a machine with no `akb`, the board spells its own command as `node
  <path>/ai4kanban.mjs`, pointing at the copy that is running. Every flow writes `akb` and
  each printed line resolves it, so a test or doc that hard-codes `akb` is the thing to fix,
  and nothing installs the command or fetches it from npm to make the name work.

## Installing and updating

- Our GitHub repo is `ai4kanban/ai4kanban` — every link, manifest and install instruction
  names it.
- A user installs and updates by running one Node script published on npm. No shell script,
  no `curl … | sh`, no git clone: the package carries the skill folder.
- Install never asks which agents you use; when it writes the skill it writes both
  `.claude/skills/kanban/` and `.agents/skills/kanban/`, and the skill names no agent's
  folder in its own instructions.
- Installing a board does not install the skill — that is a later extra, added on purpose.
  Updating still refreshes a skill already there.
- The board installs a git `pre-commit` hook wherever the skill is installed and without
  asking, writing it only when there is none and printing one line saying it did.

## Storage

- The GitHub Projects backend is wanted but parked; Notion is a later idea that gets a card
  when a user asks for it.
- We require and ship no Obsidian community plugin, so the board shows there as a grouped
  table, never as drag-and-drop columns.
- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move. One backend per project.

## Spec agents

- Two spec agents ship, and only two: `ui-design` and `technology-selection`. Adding one
  later is writing a prompt, not changing the machinery.
- A spec agent may declare settings, and one that declares none is unchanged. `ui-design`
  gets the first — mockup style — and `technology-selection` gets none.
- A card points at a mockup with a tag the board UI knows, on a line of its own —
  `<Mockup src=".mockups/239/a.html" label="A" />`. A markdown link is never drawn as one,
  so nothing a card already says turns into a mockup by accident.
- Mockups are not in git: they live under `docs/kanban/.mockups/`, which `init` gitignores,
  because a mockup is a working drawing the build throws away — so what a layout settled has
  to be in the card's words. Archiving or rejecting a card still deletes its folder.
- The two styles are `full` — a `.tsx` or `.html` screen styled like the product, in a file
  the card points at — and `ascii`, a plain-text drawing written straight into the card
  section. `full` is the default and the setting is board-wide, so a card is never a mix.
- The ASCII style writes no file because the drawing is already text the card can hold: it
  survives the pull, with no tag, folder or cleanup. It is 96 columns wide, every character
  one column, and never re-wrapped.
- One option's mockup stays short — one screen, about as long as the card's own plan.
- The Resolve dialog does not show the mockups a layout question is about: the options name
  the labels and the user opens the card page, one click away, to look.
- The list of mockup formats is written in `akb guide ui-design` only — putting it in
  `akb guide board` would cost every flow the context for a rule only screen cards need.

## Chat

- Only agents whose command can be sent a second message into the session it already opened
  can hold a chat; any other names the ones that can. A conversation is never held by
  sending the whole exchange again each turn.
- A chat does the board work itself, as soon as it is asked, through the board's own moves —
  it never writes out a change and waits for a click, and never sends the user to a button.
- It may take any action without asking, archiving, rejecting and starting a build included;
  what it changes stays in the working tree, and git is where the user takes it back.
- It adds no rule of its own: the session is an ordinary kanban-skill session, so `--print`
  does a flow there and no flag starts a run.

## Card format

- The human half is for review — one short paragraph of what the task does plus the points
  worth noting, self-contained because the agent half is folded by default. The agent half
  is for execution — `## Scope`, `## Todo` and the rest — detailed enough to implement from
  but still plain, with no coding details.
- "Worth noting" is its own section in the human half, under the summary paragraph, written
  for the reviewer; the agent reads every line and needs no such section of its own.
- A spec agent's section goes in the human half when the user has to pick from it; every
  other one stays in the agent half.
- The boundary is an HTML comment, `<!-- agent -->`, on a line of its own, which does not
  show when the card is rendered. Cards written before it are reordered the next time they
  are refined — there is no pass over the board.

## The board's language

- On a card already written in English, an agent's open question and `verify:` line still
  come in the reader's language: the two things written to be read by the user personally
  follow the setting on every card, while the body around them follows the file.
