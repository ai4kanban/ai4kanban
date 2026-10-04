# Rejected

Ideas we turned down, one line each with the reason. Read before proposing.

- **Card age on board cards** — board cards show only the key elements; per-card details like how long a card has sat don't belong there.
- **Spelling out why a workflow's lead file was refused, and the line to fix, on every screen that shows the workflow** — the agent design is new and will keep breaking; extra UI for files in an outdated format is over-designing for backward compatibility.
- **Saying on the card why an auto-refine start was refused** — overdesign that only adds upkeep; a user who finds a card left unrefined opens it and sees the lead agent is missing.
- **Cross-links between card pages and test cases (cards recording their cases, cases their source cards)** — too complicated for what it gives; overdesign.
- **Rewording a refused new-agent name into the UI language** — the current message for a taken name is good enough; another error message adds nothing.

## The board

- **An expanded specialist-agent registration form and editor** — overdesigned.
- **Cloud collaboration as just a storage switch or board-location picker** — it hides membership, questions, ownership, shared memory and delivery recovery.
- **GitHub Projects as the team's board** — the shared board lives in Cloud; GitHub Issues only feeds proposals and receives progress.
- **A ready-only focus toggle, or muting cards you can't start** — the board is small enough to scan and `ready` already says it.
- **A "holds up N" badge on blocking cards** — the padlock says more; a group's map shows the chain.
- **Switching projects from the browser UI** — a server serves the board it was started in.
- **Multi-selecting cards into a release** — it builds the manual path we don't want.
- **Routing every card read and write through the command** — the reads and writes that need one owner already go through it.
- **Drawing a screen inside an open question** — questions live in frontmatter; drawings stay in the body.
- **Dropping the card page's Edit button** — the chat rail is folded by default, so nothing else would be visible.
- **Editing a card's title, body or links on its page** — only settings are direct; the rest is an approved spec.
- **Assigning a specialist agent from the card page** — planning asks for one itself; too rare for a per-card control.
- **Keyboard shortcuts for the board** — a shortcut set costs more than the mouse trips it saves.
- **A `#` card picker in the chat box** — typing `#12` already points at a card.
- **Serving the board to a phone from the user's machine** — Cloud reaches a phone anywhere, even with the machine asleep.
- **A desktop pet that speaks notifications** — the system notification center already does it and gets out of the way.
- **A card's screens side by side on a pan-and-zoom canvas** — trades scrolling for panning at the cost of a fixed viewport and a gesture layer.
- **Tooltip polish (touch behavior, tap-to-read marks, bubble placement)** — overdesign; propose tooltip work only when the user asks for it.

## Runs

- **Replying to a running agent, or a follow-up box on a finished run** — agents ask through open questions; Resume covers the real need.
- **A per-card run history** — the latest run's log plus the runs panel is enough.
- **A plain-words reason on a failed run** — the only reason available is the agent's own output, already in the log.
- **Clickable run ids in chat replies** — saves one click, costs rules for what counts as an id.
- **A view of everything uncommitted where a run worked** — it can't say what the run changed; the card's diff does.
- **Letting the board start ready cards by itself** — needs limits on concurrency, card count and spend first.
- **One long unattended run over a group's whole subtask graph** — one run builds one approved card and lands it; unattended work is not the product.

## Connectors

- **A Gemini CLI connector** — not wanted; more connectors wait for users to ask.
- **A pi connector** — it never asks permission and nothing confines it to the project.
- **A list of model ids in the Model field** — a kept list goes stale; used ids are empty on a fresh board.
- **A login line in the agent dialog** — the board doesn't set up harnesses; Test says whether it connects.
- **Naming the broken file, bundled copy and fix when an agent CLI won't start** — users get a minimal, Apple-like UI; file paths and exit-code diagnostics are internal detail.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — the board always has an agent to run.
- **Requiring git before a folder becomes a project** — non-git builds already fall back to manual mode and say why.

## Feedback

- **A list of shared feedback numbers in Settings, or an install-id details dialog** — feedback is a side channel; `akb telemetry status` shows the id.
