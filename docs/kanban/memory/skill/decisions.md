# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## The memory set

- The set is five files. There is no `archive.md`: a file nothing writes is exactly the
  leftover we avoid. What shipped is recorded in the published docs, with a `readme.md`
  line pointing at them.
- What the agent decided by itself stays on the card, in its own section, so the user can
  check it. Only a call a future card would need reaches `decisions.md`.

## The goal

- The agent judges only whether a goal is there, never the prose: missing or still seed
  text is `weak`, anything the user wrote is at least `good`. Nagging about a goal the
  user did write is worse than no nag.
- What a good goal contains is advice in a guide setup links to — the business goal, the
  long horizon, a rough roadmap, the direction. Nothing enforces it and the file stays
  free-form.

## Finished cards

- A finished card moves to a `.archive/` folder next to `todo/`, kept in git, so finished
  work can still be read and diffed. A rejected card is still deleted — `rejected.md`
  already records why.
- The archive is not project memory. No flow reads it; `readme.md` plus the published docs
  stay the only record of shipped work.

## Setup

- Setup asks the user for one thing, the goal. It settles what the goal answers into
  `decisions.md`, and hands over every call it can't settle as `[user]` questions on one
  card that tops the board — never in the checklist, never in `decisions.md`, which holds
  only settled calls.
- Without a written `goal.md` setup stops at the goal step: nothing after it can be built
  from seed text, so there are no decisions, no module map, no first cards. A later run
  picks up from there.
- The module map comes after the decisions. A project started without code has no code to
  read a map from — the map can only come from what's been decided.
- Setup ends with 10 first cards, the ones later work builds on — never improvements aimed
  at what the project hasn't built yet.
- While `setup-checklist.md` is there the board is unfinished and no flow creates a card;
  the last tick deletes it, and a finished checklist is never kept as a record. A card the
  user writes by hand, outside the skill, is never blocked.

## The module map

- Be conservative, above all in a from-scratch repo — a simple single-purpose project is
  one module, not several. Add lines only as the code grows.
- Adding a module later moves the notes that are now clearly its own out of the memory
  they came from, once. A rename keeps the memory with the module; deleting one folds its
  memory back into the project-wide set, so nothing we learned is lost with the map line.

## Auto-refine

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it's sure of and ends either `ready` or holding only the questions a human must
  answer.

## Recurring tasks

- A built-in background job (say, pruning the memory) ships as a seeded card in the
  recurring track, run when the user sets a cadence — never as its own UI switch with its
  own state file. The card is the visible, editable record of the job; deleting it is the
  opt-out, and nothing re-adds it behind the user's back.
- A cadence is always the units grammar — `30m`, `2h`, `1d`, `1d at 09:30`. There is no
  word form like `daily` anywhere, so nothing has to translate between two.

## Open questions

- A question can carry options — `single-option` to pick one, `multi-options` to pick as
  many as you want — and one with no options stays an open-ended ask.
- A question written as prose with the choices inside it keeps working and is never
  rewritten. Both shapes live side by side; no card is migrated.

## Releases

- A version ships when the user says it ships, open cards or not. Closing clears the
  release off the cards still open; they are never moved into the release afterwards.
- The open releases are one line each in `docs/kanban/releases.md`, in ship order, holding
  only what is still ahead — short enough that reordering and renaming are hand edits.
- A version id is letters, numbers, dot, dash and underscore, kept as typed. A card with
  no release has an empty field; there is no sentinel name for that state.
- A card naming a release that is not on the list keeps it, and `release list` names the
  id so it can be put back. The board never clears the field and never refuses to run over
  it — but setting a release the list doesn't have is still an error, so a typo can't
  invent a version.
- A release with a goal is filled against that goal, by an agent run: it judges each open
  card on whether it ships the goal, and writes the cards the goal needs that the board
  hasn't got. The run's log is the record of what it moved, wrote and left out.
- A release with **no** goal keeps the plain rule: the cards in no release that are high
  priority, have nothing open blocking them, and are not a group root. With nothing to plan
  against, a rule the user can predict is all there is.
- Filling only ever adds — a card already in another release is left alone — so it can be
  run as often as the goal changes, and taking a card back out is always the user's move.

## Installing and updating

- Our GitHub repo is `ai4kanban/ai4kanban` — every link, manifest, and install
  instruction names it, and nothing leans on the old `dist0com` redirect.
- A user installs and updates by running one Node script published on npm —
  `npx ai4kanban install` and `npx ai4kanban update`. No shell script, no `curl … | sh`,
  no git clone: the package carries the skill folder. The plugin channel is unaffected.
- Install never asks which agents you use; when it writes the skill it writes both
  `.claude/skills/kanban/` and `.agents/skills/kanban/`. The skill names no agent's folder
  in its own instructions, so it also runs from wherever another installer put it.
- **Does installing a board also install the skill?**: no. Install scaffolds the board and
  leaves the agent folders alone — the skill is a later extra, added on purpose from the
  UI's button or one terminal command. Updating still refreshes a skill that is already
  there.

## The command

- One command owns every board and agent action, and the skill shrinks to a short note
  pointing at it. The UI drives its runs through the same command, so there is one
  implementation of every move rather than one per surface.
- What we teach a person is the actions the UI's buttons stand for — implement, refine,
  propose, archive. The board's own bookkeeping stays a command the agent calls and stays
  out of the README: nobody wants to type "set card 12's priority to high".
- The command is a Node program, not a compiled binary. Everything the board already runs
  on — the installer on npm, the desktop app's Electron, the agents driving the board —
  carries Node, so a binary would remove no dependency and would add six signed builds per
  release to the app and the download page.
- The desktop app keeps carrying the command and running it under Electron's own Node, so
  the app still needs nothing installed on the machine.
- **What does `akb` typed alone do?**: installed by the app, it opens the app — the same
  command is the CLI when given an action, the way `cursor` works. The npm copy keeps
  printing help; it has no app to open.

## Storage

- The GitHub Projects backend is wanted but parked — nothing is built until we pick it up.
  Notion is a later idea; it gets a card when a user asks for it.
- We require and ship no Obsidian community plugin, so the board shows there as a grouped
  table, never as drag-and-drop columns.
- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move. One backend per project.

## Spec agents

- Two spec agents ship, and only two: `ui-design` and `technology-selection`. No third.
  Adding one later is writing a prompt, not changing the machinery — worth doing once the
  two we ship prove the shape.
- **How does a card body point at a mockup file?**: with a tag the board UI knows, on a line
  of its own — `<Mockup src=".mockups/239/a.html" label="A" />`. A markdown link is never
  drawn as a mockup, so nothing a card already says turns into one by accident.
- **Are mockups in git?**: no. They live in `docs/kanban/.mockups/`, which `init` adds to the
  board's own `.gitignore` — a mockup is a working drawing the build throws away, and keeping
  it out of the repo means what a layout settled has to be in the card's words. Archiving or
  rejecting a card still deletes its folder; there is just nothing to read it back from.
- **Does the Resolve dialog show the mockups a layout question is about?**: no. The options
  name the labels `A` and `B` and nothing more; the user opens the card page, one click
  away, to look at the drawings. Nothing links the dialog back to the card.
- **How long may one option's mockup run?**: short — one screen, and about as long as the
  card's own plan. The agent trims detail to stay inside it.

## Chat

- **Which agents can hold a live conversation?**: only the ones whose command can be sent a
  second message into the session it already opened. Any other agent says chat is not
  available on it and names the ones it is — a conversation is never held by sending the
  whole exchange again each turn, which would cost more with every message.
- **Does a chat do the board work itself?**: yes — it does what it is asked as soon as it is
  asked, through the board's own moves. It never writes out a change and waits for a click,
  and never sends the user to a button. A card's chat is that same chat and acts too.
- **Which actions may a chat take without asking first?**: all of them, archiving, rejecting
  and starting a build included. What a chat changes stays in the working tree, and git is
  where the user takes any of it back.
- **How does chat choose between doing work here and starting a run?**: it adds no rule of
  its own. The rail is an ordinary kanban-skill session: `--print` does a flow there, no
  flag starts a run, and users may run any `akb` command they want.

## Card format

- **Where does a card's `### Worth noting` heading sit?**: inside `## Decided by the
  agent`, after that section's plain lines. It holds the agent's calls a human might have
  made differently; the obvious ones stay in the plain lines above it.
