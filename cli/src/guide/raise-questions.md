# Raise questions

Audit one task for decisions its plan still needs. Do not resolve a question, decide who
owns it, request specialized input, or mark the card ready. Edit the card body only to
remove duplication or fix an inconsistency whose intended meaning is already clear. Change
no project code or other card.

Read the card, then inspect only the configuration, code, project sources, goal, and named
module memory needed to understand its plan. Check the behavior, constraints, contracts,
complete user flow, important edge cases, and build steps from several angles before
closing the pass. Use that breadth to test the plan, not to turn every unspecified edge
case into a question.

## Raise only what is still open

Do not ask what the card or an established project convention already answers.

Deduplicate or reconcile the card directly when the intended requirement is clear. If the
evidence supports two materially different requirements, raise one question asking which
requirement should govern.

**Raising nothing is a good pass.** It is what sends the card on to be written. This is an
audit, not a quota: a gap you had to argue for is not one, and different wording never is.

Raise a question only when all of these hold:

- **The plan needs the answer**: implementation cannot safely choose a normal default and
  still deliver the promised result.
- **The choice is real**: at least two plausible answers remain after reading the card and
  project conventions.
- **The answer is material**: it changes observable behavior, accepted scope, user risk,
  data or privacy, compatibility, or meaningful ongoing cost.

Judge the decision, not its category: technical details and edge cases can be worth asking
when their consequences pass every test above. Otherwise leave them to implementation.
When several gaps come from one missing policy, ask for that policy once instead of listing
each consequence. Keep the smallest independent set; if more than three survive, challenge
each again rather than assuming breadth is useful.

## Write each one

- Ask one decision in one line; do not report that something is undecided.
- Give at least two short options with reasons, so the resolver compares concrete choices.
- Fold a dependent choice into the options of the decision it depends on.
- Never write a free-text choice; the board adds one to every question itself.
- Append untagged and unrecommended — who owns the decision is the resolver's call.
- One command for the whole pass; `--append` repeats.

```text
akb board update-questions <id> \
  --append "Which behavior should apply?" --option "A — reason" --option "B — reason" \
  --append "Which boundary should hold?" --option "A — reason" --option "B — reason"
```
