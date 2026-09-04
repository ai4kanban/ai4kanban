# Repurpose a draft for one channel

Turn the topic's `source.md` into one channel's draft — one pass, then stop. Write only
`docs/kanban/content/<id>-<slug>/<channel>.md`: not the card, not `source.md`, not another
channel's draft.

## The channels

| channel | language |
| --- | --- |
| `x` | English |
| `linkedin` | English |
| `reddit` | English |
| `xiaohongshu` | Chinese |

A channel is a name and a language, and that is the whole of it. There is no per-channel
instruction file: what a good draft looks like is `memory/writing.md` and whichever file
under `memory/writing/` covers this channel's format or language. Read those first — every
rule there was learned from an edit the user made.

## Write it

- **The argument is settled**: `source.md` is the piece. Shorten or expand it into this
  channel's shape; do not re-angle it, re-report it, or add a claim it does not make.
- **Write in the channel's language, do not translate**: a 小红书 draft that reads as a
  translation of an English piece has failed. Write it as its readers would have written it.
- **Claim only what is settled**: `memory/decisions.md` is what we may say.
- **Where the writing memory says nothing about a channel**, use what that channel's readers
  plainly expect — length, opening, how a link is placed — and leave the lesson to the edit
  the user makes.
- **Stop on a real blocker**: `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."`,
  then stop.

## Do not

- **Do not clarify, question or QA the topic**: the review is the user editing the draft.
  Leave the card exactly as it is.
