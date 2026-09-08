# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## Topics and writing

- A marketing board's writer can **call in a `write` agent** rather than be replaced by one:
  a build or `akb channel` carries the roster of the board's `kind: write` agents and asks for
  one by name — `akb write <agent> <id> <note>` — which the board starts alone once that run
  ends. It writes files inside `content/<id>-<slug>/` and never `source.md`, a channel draft
  or the card, and it has no `--print`: `akb guide write-agent`, on a marketing board.
- A marketing card is a **title, its channels and its draft** and nothing else (#435). It carries
  no `priority`, `roi`, `release` or `questions` — `serializeFrontmatter` leaves all four off on
  that solution, so every move that rewrites a card leaves them off, and `unpackBoard` writes the
  fields the payload's own `config.md` names rather than this process's board. `akb raw create`
  writes no body scaffold and raises no "has no todos" warning there; `akb raw validate` asks for
  neither the four fields nor the sections, halves, order or `## Todo` checkboxes on a card under
  `todo/`, so an empty body passes — a card under `todo/recurring/` keeps every rule, and the H1,
  fence, comment, duplicate-section and `<Mockup>` checks hold on both. `--priority`, `--roi`,
  `--release`, `--question` and `akb raw update-questions` are refused. The brief is the few lines
  at the top of `content/<id>-<slug>/source.md`, which `implement` expands in place.
- A marketing card names the **channels** it goes to in `channels:`, lead channel first — the
  four are `x`, `linkedin` and `reddit` in English and `xiaohongshu` in Chinese, and a channel
  is that name and language and nothing else. `akb raw update <id> --channels <names>` chooses
  them and `akb raw channel-status <id> <channel> <status> [--url]` moves one along;
  `akb channel <name> <id>` is a run of its own that repurposes the topic's `source.md` into
  `content/<id>-<slug>/<channel>.md` and marks that channel `draft`. It refuses a channel the
  card has not chosen, a topic with no `source.md`, a non-marketing board, being typed inside a
  run, and a draft already written unless `--again` says to replace it. `akb guide channel` is
  the flow, and marketing's `akb guide prune-memory` splits a rule that stopped holding
  everywhere out of `writing.md` into `memory/writing/`.
- A marketing topic is named off its id alone: the card is `todo/<id>.md` and its drafts are
  `content/<id>/`. The title lives in frontmatter, so writing, changing or emptying one moves
  nothing, and `raw create`/`raw update --slug` are refused on a marketing board. Topics filed
  under a slug before this keep their names and their draft folders.
- A marketing board has no `implement`. `akb card implement` is refused on one the way `refine`,
  `resolve`, `decide`, `gate`, `plan-release` and `changelog` are, `akb guide implement` lists and
  serves nothing there, and the writer role no longer claims the flow. The loop in
  `akb guide board` is `create ─▶ you write ─▶ channel ─▶ …`: `add-task` ends at the `create`
  call and writes no `content/<id>/` folder, `extract-ideas` names a topic's provenance in what
  the run reports rather than in a brief, and `writing` no longer asks for one at the top of
  `source.md`. A topic's source is the user's own words; the agent's writing starts at the
  repurpose.

## The marketing solution

- The marketing solution replaces `board`,
  `writing`, `implement`, `add-task`, `extract-ideas` and `prune-memory`, adds `channel` and
  `write-agent`, drops `resolve`, `plan-release`, `changelog`, `qa-loop`, `qa-lightweight` and
  `releases`, and inherits the rest. Four flows are refused there outright: `akb card refine`,
  `akb card resolve`, `akb release plan` and `akb release changelog` — off the local UI's action
  set and off the marketing planner's list too, and never scheduled or followed up with, so
  `ready` is a stage its cards never reach and `--status ready` is refused as well.
  `akb install --solution marketing` scaffolds that layout — `content/`, `skills/`, `rules/`, and a memory set of `decisions.md`,
  `rejected.md`, `writing.md` and `published.md`, with no goal, redesign, readme, releases or
  setup checklist — and a build on it writes `content/<id>-<slug>/source.md` in the repo with no
  worktree, branch, review or landing.

## The board and draft editor

- A **marketing board draws one card column** — **Topics**, with every open topic and how many
  are being written — beside Recurring, since a topic never reaches "ready". Its cards wear
  their channels where a product card wears priority and ROI, the header has no release picker,
  the card page offers neither Refine nor Resolve, and Implement opens with no "not marked
  ready" warning to tick.
- **A marketing board opens a topic straight into its draft**: the header and the empty-board
  panel say **New topic**, and one press writes the card, opens its page and puts the cursor in
  the `source.md` editor — no discussion, no task-description box, no Start planning or Build
  now, and no agent. The empty editor invites an idea, notes or pasted copy where the caret is.
  The title row is editable in place: it opens `Untitled` in placeholder style, clears on focus,
  and emptying it writes `Untitled` back. An unwanted topic leaves from the topic page's `…`
  menu — **Discard topic** — and one left blank stays on the board until you press it. The rail
  lists no discussions on a marketing board.
- **A topic's source is never drafted for you**: the **Draft source** button is off the foot of
  the empty source tab, and `implement` is refused on a marketing board from the browser too. An
  empty source now shows what a channel's does — the stopped-run notice, when a polish over it
  ended unfinished — and the invitation at the caret is all a blank one says. An `implement`
  still in a board's run log reads as an ordinary run.
