# Review a piece

Review and fix in this run. A successful run with no new question passes; a question appended
to the card waits for the user's answer.

1. **Check that something was written.** Compare the delivery against its base. A delivery
   whose files are identical to the base has produced nothing — fail it, say that the piece
   itself is what is missing, and stop. "There was nothing to write" is never the verdict.
2. Read every file the delivery wrote against the approved requirements: the goal, the reader
   it is for, and the outline planning settled. Trace each requirement to the text that
   answers it. Do not reopen decisions the card already answers.
3. Fix plain mistakes — wording, structure, a claim the sources do not carry, a heading the
   outline does not have — in the delivery's own worktree. Route additional work through
   `akb guide follow-up`.
4. Only when a finding needs a user decision or a human-only check, read
   `akb guide update-questions`, append a `[user]` question to this card and stop. Otherwise
   finish successfully; no card edit is required to pass.

- **No code bar**: tests, coverage and diff size say nothing about a piece of writing. Run
  only the checks the repository requires of the files that changed.
- **Claims need a source.** Anything stated as fact is either in the material the card
  carries or is marked as the writer's own reading of it.
