# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## Topics and writing

- A marketing card is a **title, its channels and its draft** and nothing else: no priority,
  ROI, release or questions, no body scaffold and no section rules, so an empty body passes.
  The piece itself is `content/<id>/source.md`.
- A topic is named off its id alone — the card is `todo/<id>.md` and its drafts are
  `content/<id>/` — so writing, changing or emptying a title moves nothing. Topics filed under
  a slug before this keep their names.
- A card names the **channels** it goes to in `channels:` — `x`, `linkedin` and `reddit` in
  English, `xiaohongshu` in Chinese. `akb channel <name> <id>` repurposes `source.md` into
  `content/<id>/<channel>.md` and marks that channel `draft`, refusing a channel the card has
  not chosen and a draft already written unless `--again` says to replace it:
  `akb guide channel`.
- A marketing board has no `implement`, `refine`, `resolve`, `decide`, `gate`, `plan-release`
  or `changelog`. The loop in `akb guide board` is `create ─▶ you write ─▶ channel ─▶ …`, and
  a topic's source is the user's own words — the agent's writing starts at the repurpose.
- A marketing board's writer can call in a `write` agent rather than be replaced by one:
  `akb write <agent> <id> <note>`, writing files inside `content/<id>/` and never `source.md`,
  a channel draft or the card: `akb guide write-agent`.
- `akb marketing verify <channel> <id>` loops a draft against the writing memory, fixing what
  it finds and checking again, stopping on a clean pass or after three.

## The marketing solution

- `akb install --solution marketing` scaffolds the layout — `content/`, `skills/`, `rules/`,
  and a memory set of `decisions.md`, `rejected.md`, `writing.md` and `published.md`, with no
  goal, redesign, readme, releases or setup checklist.
- The solution replaces `board`, `writing`, `implement`, `add-task`, `extract-ideas` and
  `prune-memory`, adds `channel` and `write-agent`, drops the release and QA flows, and
  inherits the rest. A build on it writes into the repo with no worktree, branch, review or
  landing.

## The board and draft editor

- A marketing board draws one card column — **Topics** — beside Recurring: cards wear their
  channels where a product card wears priority and ROI, there is no release picker, and the
  card page offers neither Refine nor Resolve.
- **New topic** replaces Create task: one press writes the card, opens its page and puts the
  cursor in the `source.md` editor, with the title row editable in place. An unwanted topic
  leaves from the topic page's `…` menu.
- A topic's source is never drafted for you: there is no **Draft source** button, and an empty
  source says only what the caret invites.
- The comments on a draft are a markdown file you can edit, one per draft under
  `docs/kanban/.comments/<id>/`: an entry is a quoted passage with the change written under
  it, found again wherever the draft has moved it, and editable in any editor.

## Published elsewhere

- **[awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban)** is a public
  directory of tools that put agents to work on tasks, sorted by what the reader wants to hand
  over — AI Project Managers, Agent Orchestration, Agent Coordination & Memory — opening with
  the three definitions, then the entries, then the inclusion criteria and how to contribute.
  English only, CC0, with AI4Kanban listed under the same criteria as everything else.
