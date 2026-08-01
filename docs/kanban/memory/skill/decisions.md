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

- **What makes a goal `weak`?**: the file is missing, or still the seed text. Anything the
  user wrote is at least `good`. The agent does not judge the prose — there is no format
  to judge it against, and nagging about a goal the user did write is worse than no nag.
- **Do we tell the user what a good goal contains?**: yes, as a guide page in
  `docs/guides/` that setup links — advice on the business goal, the long horizon, a
  rough roadmap, the direction. Advice only; nothing enforces it and the file stays
  free-form.
- **What does the seeded `goal.md` say?**: one wording, short, used by the script and
  shown by the local UI's goal box. The two never say different things.

## Finished cards

- A finished card moves to a `.archive/` folder next to `todo/`, kept in git, so finished
  work can still be read and diffed. A rejected card is still deleted — `rejected.md`
  already records why.
- The archive is not project memory. No flow reads it; `readme.md` plus the published docs
  stay the only record of shipped work.

## Setup

- **Does setup ask the user anything about the goal?**: No. Setup reads `goal.md` and
  settles every detail it can by itself, each as a line in the project-wide
  `decisions.md`. What it can't settle becomes a `[user]` open question on the cards it
  creates, answered later through the normal resolve flow. Neither count is capped.
- Setup settles `goal.md` and the project-wide `decisions.md` before it writes
  `modules.md`. A project started without code has no code to read a module map from —
  the map can only come from what's been decided.
- **What if the user never writes `goal.md`?**: setup stops at the goal step. Nothing after
  it can be built from the seed text, so there are no decisions, no module map and no first
  cards. The board's setup bar keeps asking for the goal, and a later setup run picks up
  from that step.
- **How many first cards does setup end with?**: 10. They lay the foundation later work
  builds on — never improvement tasks aimed at what the project hasn't built yet.
- **Where does the setup checklist live?**: `setup-checklist.md` at the board root, next
  to `config.md` — one fixed path every flow and the UI read. It is board state, not
  memory.
- **How does a flow know setup is unfinished?**: the checklist file is there. Setup's last
  step deletes it, so a board without the file is a board that is set up. A finished
  checklist is never kept as a record.
- **What are setup's steps?**: six, in this order — install, config, goal, decisions,
  modules, tasks. Each box names the step and who does it: the script (already done when
  the file is written), the agent, or the user. A later step joins the list by being added
  to it, never by a second list.
- **Who ticks the goal box?**: the local UI, when its goal editor saves. That is the one
  step the board can finish itself; every other box is ticked by the agent running
  `setup-done <step>`.
- **May a card be created before setup ends?**: no. While the checklist file is there,
  propose and add create nothing and ask the user to finish setup first. A card the user
  writes by hand, outside the skill, is not blocked.

## What `init` writes

- **Does `init` keep the board's keys file out of git?**: yes. It writes
  `docs/kanban/.gitignore` with `.env` in it — on a fresh board, and on an older board when
  it is re-run — so a key someone writes into `docs/kanban/.env` by hand is safe on a board
  that never opens the local UI. Only `.env` goes in that file, and the repo's root
  `.gitignore` is never touched.

## The module map

- **How many modules?**: be conservative, above all in a from-scratch repo — a simple
  single-purpose project (say, one small web server) is one module, not several. Add
  lines only as the code grows.
- **Does a module added later get the older notes about it?**: yes. Adding a line to the
  map moves the notes that are now clearly that module's out of the memory it came from,
  once. A rename keeps the memory with the module.
- **What happens to a deleted module's memory?**: it is folded back into the project-wide
  memory and the folder goes away, so nothing we learned about that part is lost with the
  map line.

## Auto-refine

- One session drives one card the whole way. It never pauses to ask the user: it answers
  what it's sure of and ends either `ready` or holding only the questions a human must
  answer.

## Open questions

- **Can a question carry options?**: yes, in two shapes — `single-option`, where the user
  picks one, and `multi-options`, where the user picks as many as they want. A question
  with no options stays an open-ended ask.
- **Do old questions have to be rewritten?**: no. A question written as one prose line with
  the choices inside it keeps working and renders as a plain question. The agent never
  rewrites it, and no card is migrated — both shapes live side by side.

## Releases

- **Can a release be closed while cards in it are still open?**: yes, always — a version
  ships when the user says it ships. The open cards go back to `next`; they are never moved
  into the release after it.
- **Where do the releases live?**: one line each in `docs/kanban/releases.md`, in the order
  they ship. The file holds only what is still ahead, so it stays a line or two long — short
  enough that reordering and renaming are hand edits, not commands.
- **What is a version id allowed to be?**: letters, numbers, dot, dash and underscore, kept
  as typed — closing a release writes a file named after it. `next` is not a version id: it
  is where a card with no release sits, always last, and never written in the file.
- **What if a card names a release that is not on the list?**: the card keeps it and
  `release list` names the id, so it can be put back or the cards moved. The board never
  clears the field and never refuses to run over it. Setting a release the list doesn't have
  is still an error — a typo must not invent a version.
- **What does the agent put in a release when it fills one?**: the cards at `next` that are
  high priority, have nothing open blocking them, and are not a group root. It never reads a
  card to judge how big it is — a plain rule the user can predict beats a smarter one they
  have to check.

## Installing and updating

- **Which GitHub repo is ours?**: `ai4kanban/ai4kanban`. The project moved off
  `dist0com/ai4kanban`; every link, manifest, and install instruction names the new one.
- **How does a user install and update?**: by running one Node script, published on npm —
  `npx ai4kanban install` and `npx ai4kanban update`. No shell script, no
  `curl … | sh`, and no git clone: the package carries the skill folder. The plugin
  channel is unaffected.

## Where the skill folder lives

- **Who decides where the skill folder lives?**: our install prompt does, and it never asks
  which agents you use — it copies the skill into both `.claude/skills/kanban/` (Claude
  Code) and `.agents/skills/kanban/` (Codex). The skill names no agent's folder in its own
  instructions, so it also runs from wherever another installer — `npx skills add`, a
  plugin — put it.

## Storage

- The GitHub Projects backend is wanted but parked — nothing is built until we pick it up.
- Notion is a later idea; it gets a card when a user asks for it.
- We require and ship no Obsidian community plugin, so the board shows there as a grouped
  table, never as drag-and-drop columns.
- The memory set, `metrics.csv` and `next-id` stay local markdown on every backend — only
  cards ever move to another backend.
- One backend per project; the board is never mirrored to a second one.
