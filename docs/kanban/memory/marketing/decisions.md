# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Writing and channels

- **A channel is a name and a language, not a skill**: `akb channel <name> <id>` carries one
  built-in instruction — repurpose `source.md` for that channel in that channel's language —
  and there is no per-channel instruction file to edit. `x`, `linkedin` and `reddit` are
  English, `xiaohongshu` is Chinese, and the four ship inside the command.
- **The writing memory is what decides quality**: `memory/writing.md` and the files under
  `memory/writing/` are where the user's taste lives, so a rule learned on one channel
  reaches every channel it fits. Nothing declares formats.
- **A learned rule is filed by topic inside the writing memory**: a polish appends a rule to
  the `memory/writing/` file whose topic it belongs to — what the rule checks, not the
  language, format or channel it was learned on — and one no topic file covers to
  `memory/writing.md`; never beside `decisions.md` in `memory/`.
- **Repurposing does not follow the write run**: the user runs `akb channel` per channel
  once `source.md` reads right.
- **Publishing is local-first, never a channel API**: a piece goes out from a browser the user
  is already signed into on their own machine — the vendored 小红书 skill, or the channel's
  own composer carrying the draft. No developer account is funded and no token is
  kept alive, so X and LinkedIn numbers stay whatever the user last typed.
- **A repurpose run is one pass; the loop is a step of its own**: `akb channel` only shortens
  or expands `source.md` into the channel's shape and stops. `akb marketing verify` is what
  the user runs next, and it is one run that loops — it checks the draft against the writing
  memory, fixes what it found and checks again, stopping on the first pass with nothing to
  fix or after three. There is still no clarify or QA phase on a draft: the loop reads
  written-down rules, not the topic.
- **The board never picks a cheaper runtime for you**: every run, the draft polish loop
  included, goes on the runtime its agent is pointed at, and on **Global default** when it
  names none.
- **A user `write` agent adds to the writer, never replaces it**: the bundled writer keeps
  writing the draft and calls a named specialist — an image generator, say — when one helps,
  the way a planning run asks for a spec agent.
- **A marketing card has no `ready` stage**: with no refine to vet a topic, a card only moves between `todo` and `implementing`, and the board is one column of cards plus the recurring one — nothing on the board says which topic is written next.
- **The verifier is a namespaced command**: `akb marketing verify <channel> <id>`, not a
  top-level `akb verify`.
- **A format change takes the cards already open with it**: cutting the marketing card down
  rewrites the topics already in flight rather than grandfathering them — their unanswered
  angle and channel options become a few lines of angle at the top of `source.md`, and the
  board never carries two card formats at once.
- **A topic's first real title renames its files**: a card still filed as `<id>-untitled`
  re-slugs its card file and moves `content/<id>-<slug>/` with it, so a topic never reads as
  `untitled` for life; later retitles move nothing, and neither does a title written while a
  run holds that card.
- **A new topic's `source.md` starts empty**: no flow writes a brief into it — the angle,
  the audience and the limits are settled in the card's own chat, and the file stays blank
  until the user writes the piece.
- **A marketing card has no lead channel**: `source.md` is the argument and belongs to no
  channel, so `channels:` is only the set of channels the topic goes to, in the order the
  user picked, and every chosen channel is repurposed from the source.

## The topic page

- **A card's channels are picked on the page, not asked for**: the tab strip's picker lists
  the channels this card has not chosen and adds the picked one as a tab, so nothing waits
  on a run.
- **Closing a channel tab drops the channel from the card**: the card's channel list is the
  only record of which tabs exist, so a close loses that channel's status and URL while the
  draft file stays and reopening brings it back.
- **The draft editor keeps the syntax marks on screen**: headings, bold and links take
  their styles as you type while `##` and `**` stay in the line, so a draft is edited
  exactly as it sits in the file the agent wrote.
- **A batch of draft comments is cleared once its polish returns**: the polished draft is
  the answer, so no comment stays behind as resolved and there is no list to dismiss.
- **New topic replaces Create task everywhere on a marketing board**: the header, the empty
  board and the rail all offer New topic, so the planning entry never shows there.
- **An unwanted topic is discarded by hand**: it leaves the board from the topic page's `…`
  menu, and a blank topic left behind is never removed automatically.
- A marketing board draws one column of cards plus the recurring one: there is no `ready`
  stage to split them by, so the ready/not-ready halves collapse into a single column.
