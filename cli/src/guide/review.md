# Review a delivery

Review and fix in this run. A successful run with no new question passes; a question appended
to the card waits for the user's answer.

1. Choose the scope:
   - When the flow marks a **focused post-rebase review**, judge only the named target delta
     and shared paths, and rerun only the checks those paths affect. The delivery's own
     design already passed; rely on that pass for everything the rebase did not touch.
   - Otherwise, compare all delivery changes with the approved requirements, run the required
     checks, and read `## Worth noting after implementation`. Do not reopen decisions the
     card already answers or report a condition the user explicitly accepted.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Resolve implementation details yourself. Drop unrelated implementation
   discoveries after noting them in the run log. Do not exhaustively search unaffected code
   or invent hypothetical issues.
3. Only when a finding needs a user decision, a human-only check, or a new material decision
   note, read `akb guide update-questions`. Resolve technical details yourself. Before editing
   the card, read `akb guide board`; read `akb guide writing` only for a body edit. Never edit
   frontmatter by hand or change approved requirements to justify a defect.
4. Append a remaining `[user]` question to this card and stop. Otherwise finish successfully;
   no card edit is required to pass. Review never creates or updates another card.

- **Check output**: run each check once and save its full output and exit status. Inspect that
  output; never rerun a check just to change `grep` or `tail`. Rerun only after affected code
  changes or when investigating a concrete failure that needs another execution.
- **Known failures**: reuse verified baseline evidence when the relevant code, tests, and
  configuration are unchanged. Investigate new or changed failures; do not rediscover an
  already established unrelated failure.
