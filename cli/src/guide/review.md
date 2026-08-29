# Review a delivery

Review and fix in this run. A successful run with no new question passes; a question appended
to the card waits for the user's answer.

1. Compare all delivery changes with the approved requirements, run the required checks, and
   read `## Worth noting after implementation`; do not report a condition the user explicitly
   accepted there.
2. Fix plain mistakes in the delivery's worktree, update focused tests, and rerun the
   affected checks. Resolve implementation details yourself. Drop unrelated implementation
   discoveries after noting them in the run log; never create or update another card from
   review. Do not exhaustively search unaffected code or invent hypothetical issues.
3. An unresolved fact, unavailable source, implementation detail or manual check is not a
   user decision. Research and fix it; put a check that can safely happen later in `verify:`.
4. Only when the delivery cannot land safely without a genuine user-owned decision, follow
   `akb guide update-questions`, append that decision to this card, and stop.
   Append nothing when the work is ready; ending the run successfully passes review.

Do not reopen anything the card already answers, including
`## Worth noting after implementation`. Review never creates or updates another card.

Put an answered material decision surfaced by the build under `## Worth noting after
implementation` only when the user could reasonably reverse it, using the compact format in
`akb guide writing`. Never use the section to accept work that contradicts the approved
requirements; fix that work or append a genuine user-owned decision. Drop separate
implementation work; task discovery belongs to an explicit planning flow.
