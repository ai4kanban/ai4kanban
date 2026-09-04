# Write a settled topic

Write the approved topic's draft. Do not add, rewrite, or tag questions on the card.

The deliverable is one file: `docs/kanban/content/<id>-<slug>/source.md`, written for the
card's **lead channel** — the first entry in its `channels:`, or, on a card that names none,
the lead channel its `## Scope` names. There is no branch, no worktree and no diff to
review — the review is the user editing the draft.

- **Read the voice first**: `memory/writing.md`, then whichever file under `memory/writing/`
  covers this format or language. Every rule there was learned from an edit the user made;
  breaking one is how it gets learned twice.
- **Read what has been said**: `memory/published.md` for what is already out, and
  `memory/decisions.md` for what we may claim. Never claim something the board has not
  settled.
- **Write the whole piece**, not an outline. The card's `## Scope` is the brief; the angle,
  the hook and the audience are already settled on it.
- **Stop on a real blocker**: when the work cannot safely continue, run
  `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."`, then stop.
- Do not replace or contradict what the card says.
- **Repurposing is a later pass**: `akb channel <name> <id>` writes each chosen channel's
  own draft from this one, including the lead channel's. Do not write any of them here, and
  do not touch `channels:`.
