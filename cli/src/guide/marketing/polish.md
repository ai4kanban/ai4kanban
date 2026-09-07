# Polish a draft from its comments

Work every comment left on one draft into a single pass over it, then record reusable
corrections in the board's writing memory. Write only that draft and the writing-memory
files those corrections need. Leave the card, other drafts and the comments file alone:
the board clears the batch when this run ends.

## The batch

`docs/kanban/.comments/<id>.json` holds one entry per draft. Read the list under this
draft's name; each comment is:

| field | what it is |
| --- | --- |
| `quote` | the passage the reader was looking at |
| `from`, `to` | where it sat when the comment was left |
| `words` | what they want done with it |

- **Find the passage by its quote**, starting near `from`. The draft has been edited since,
  so the offsets are a hint and the quote is the anchor.
- **A quote no longer in the draft is still an ask**: the passage was rewritten or cut, so
  read `words` as being about the draft as it now stands, and do what it asks.

## Work them together

- **One pass, not one per comment**: the whole point of a batch is that the comments are
  read against each other. Two that pull the same paragraph in different directions are one
  rewrite, not two.
- **Change what was commented on, and its neighbours only where the change needs it**: an
  untouched paragraph stays byte for byte.
- **The argument is settled**: do not re-angle the piece, add a claim it does not make, or
  raise a question on the card. `memory/decisions.md` is what we may say.
- **Keep the draft's language and shape**: a channel's draft is still written for that
  channel — `memory/writing.md` and `memory/writing/` are the standard.
- **Stop on a real blocker**: `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."`,
  then stop without writing a rule. The batch survives, so the reader can submit it again.

## Keep what the next piece can use

Finish the draft first, then write only reusable corrections learned from this batch.

- **File by where it holds**: use `memory/writing.md` unless the rule is bound to a language's
  idiom or a format's shape or length. File those under `memory/writing/<language-or-format>.md`
  (for example `chinese.md`), never directly under `memory/`. Learning it on one channel does
  not make it a channel rule. Create, merge and rename files under `memory/writing/` as needed.
- **Source has no channel**: a correction to `source.md` can teach a general or language rule,
  never a format rule.
- **Say it once**: read the relevant writing memory and sharpen the entry that already covers
  the correction; otherwise add `- ❌ <mistake> → ✅ <what to do instead>`. Use the existing
  topic heading that covers it, or append to the list if there are no headings. Do not regroup,
  rewrite surrounding entries or prune the memory.
- **Nothing reusable writes nothing**: this piece's facts, links and numbers are one-off fixes.
  Leave no empty file, new heading or restated draft edit when there is nothing to learn.
