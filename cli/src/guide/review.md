# Review a delivery

Review and fix in this run. A successful run with no new question passes; a question appended
to the card waits for the user's answer.

1. Choose the scope:
   - When the flow marks a **focused post-rebase review**, judge only the named target delta
     and shared paths, and rerun only the checks those paths affect. The delivery's own
     design already passed; rely on that pass for everything the rebase did not touch.
   - Otherwise, compare all delivery changes with the approved requirements, run the required
     checks, and read `## Worth noting after implementation`; do not report a condition the
     user explicitly accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Resolve implementation details yourself. Drop unrelated implementation
   discoveries after noting them in the run log; never create or update another card from
   review. Do not exhaustively search unaffected code or invent hypothetical issues.
3. Classify every unresolved decision and later hand-check with `akb guide update-questions`.
   Research, resolve, or fix anything it does not classify as a `[user]` question or `verify:`.
4. If the classification leaves a `[user]` question, append it to this card and stop.
   Append nothing when the work is ready; ending the run successfully passes review.

Do not reopen anything the card already answers, including
`## Worth noting after implementation`. Review never creates or updates another card.

Classify answered decisions surfaced by the build with `akb guide update-questions`, then format
them with `akb guide writing`. Drop separate implementation work; task discovery belongs to an
explicit planning flow.
