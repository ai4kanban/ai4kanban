# Implement the approved requirements

Build the approved card or plan directly. Preserve settled decisions and unrelated questions;
do not replace or contradict the approved requirements. With no card, build only the given
requirement and create no card.

- **Check applicability**: use the working directory, project instructions, configuration
  sources and change history as evidence; missing configuration alone does not make a check
  inapplicable. Explain any inapplicable check and its alternative verification; never report
  an unrun or failing check as passed. Do not bypass checks with empty configuration, disabled
  checks or lower standards.
- **User-action blockers**: ask only when this build needs a decision, permission or material
  only the user can supply. On a card, append it as a question per `akb guide update-questions`;
  a question only in your reply never reaches the user. Continue independent work.
- **Defer what can wait**: follow `akb guide follow-up` for work this build does not require;
  never ask about it or let it block this build.
- **Decisions made while building**: record an answered material decision the user could
  reasonably reverse under `## Worth noting after implementation` on the card.
- **Resume**: inspect the existing result and the unchecked todos, carry completed steps
  forward, and finish the remaining todos before recording completion.
