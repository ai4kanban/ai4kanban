# How this board works

A marketing board. One card is one **topic**, published to one or more channels. These
rules apply to every card workflow here; each workflow's guide covers the rest.

## Layout

```
docs/kanban/
├── todo/           open topics
│   ├── README.md   the index — read it first
│   ├── <id>.md     one card per file — todo/ is flat. A topic is named off its id alone:
│   │               its title is frontmatter, so writing one moves nothing
│   └── recurring/  jobs we repeat (`akb guide recurring-task`) — never archived
├── content/<id>/
│                   the deliverable: `source.md`, and `<channel>.md` per chosen channel.
│                   Tracked in git and kept after the card is archived
├── memory/
│   ├── decisions.md, rejected.md
│   │               positioning, audience, what we may claim — and what we turned down
│   ├── writing.md  the voice: what every piece shares
│   ├── writing/    a rule that holds somewhere narrower — per format, per language. Add,
│   │               merge and drop these files as the rules demand; no layout is fixed
│   ├── published.md
│   │               one line per published piece: channel, URL, result
│   └── <pillar>/   a pillar's own decisions.md and rejected.md
├── agents/<name>/AGENT.md
│                   a spec agent this board adds of its own
├── rules/          one rule per agent, in the user's own words — `<agent>.md`, named by a
│                   role the board ships (`planner`, `writer`, `reviewer`) or a spec agent,
│                   appended to the end of every run that agent does
├── modules.md      the pillars — one line each
├── config.md       board settings — the solution, and the planning sources
├── next-id         the next free id — NEVER edit by hand; only `akb raw` writes it
├── metrics.csv     one row per day — never touch
└── record.csv      what board commands counted as they ran — nobody edits it by hand
```

There is no `goal.md`, no `redesign.md`, no `readme.md` and no `releases.md` on this board.
Positioning lives in `decisions.md`; a lesson from an edited draft is a writing rule.

## Configuration

**Read `docs/kanban/config.md` before proposing or adding topics.** It names the planning
sources — the product board's goal and what shipped, the site docs, and this board's own
`published.md` and `rejected.md`.

## The loop

```
create ─▶ implement ─▶ you edit ─▶ channel ─▶ you edit ─▶ publish ─▶ archive
 topic     source.md               <channel>.md            published.md
                                                          + writing lessons
```

A card is a title, its channels and its draft — there is no brief on the card and no
refining pass over it. The angle, the audience and the hook are settled in the card's own
chat, and the few lines at the top of `content/<id>/source.md` are what `implement`
expands.

`akb channel <name> <id>` is a step you take, once `source.md` reads right — one run per
channel, and the source tab's repurpose starts one for every chosen channel at once.

## Channels

A topic goes to the channels its card names, in `channels:`. The order is the one you
picked them in: it orders the tab strip, and nothing else — no
channel leads. Every chosen channel gets its own file — `source.md` is the argument,
written for no channel, and is never published.

| channel | language |
| --- | --- |
| `x` | English |
| `linkedin` | English |
| `reddit` | English |
| `xiaohongshu` | Chinese |

A channel is a name and a language, and that is the whole definition — there is no
instruction file per channel. The table is the default: `akb channel --language <language>`
writes one repurpose in another language instead, and changes nothing on the card. What
makes a draft good is `memory/writing.md` and `memory/writing/`, so a rule learned on one
channel reaches every channel it fits.

Two moves write the field, and nothing else touches it:

```text
akb raw update <id> --channels x,xiaohongshu       # chosen, in the order you picked
akb raw channel-status <id> x published --url ..   # move one channel along
```

`akb channel` sets a channel to `draft` itself, once it has written the file.

## Task ID

Every topic's id is the number at the front of its filename. Ids are global and never
reused; only `akb raw create` allocates them.

## Never hand-write a card's frontmatter

`akb raw create`, `update`, `update-verify` and `channel-status` manage the metadata.
`akb raw help` lists every move.

## The memory set

- **decisions.md** — what we settled: positioning, audience, the claims we may make, the
  pillars. One `## ` heading per pillar.
- **rejected.md** — the topics and angles we turned down, and why. Read before proposing,
  so a rejected idea does not come back as a new card.
- **writing.md** — the voice every piece shares, as `- ❌ … → ✅ …` lines in the user's own
  words. Grown from the edits the user makes to a draft, never invented.
- **writing/\*.md** — a rule that holds only for one format or one language. Split a rule
  out of `writing.md` when it stops holding everywhere.
- **published.md** — one line per published piece: date, channel, URL, and what it did.

## Finish a task

A topic is finished when every channel in `channels:` reads `published` and its line is in
`published.md`. Then `akb raw archive <id>` — the card leaves the board and its
`content/<id>/` folder stays in git.
