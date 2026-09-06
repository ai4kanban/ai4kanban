# Polish a draft from its comments

Work every comment left on one draft into a single pass over it, then stop. Write only that
draft — not the card, not another draft, and not the comments file: the board clears the
batch when this run ends.

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
  then stop. The batch survives a run that did not finish, so the reader can submit it again.
