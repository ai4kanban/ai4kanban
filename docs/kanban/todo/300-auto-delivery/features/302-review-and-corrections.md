---
title: Review a run's work against the approved card, and send clear mistakes back
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [301]
related: [300]
modules: [local-ui, skill]
questions: []
---

Nothing checks a run's output today. The agent says it is done and the card is ticked. Add an
independent review: a fresh session gets the approved card and the run's diff — never the
implementation transcript — compares them, sends clear mistakes back for correction, and blocks
landing when it hits something only a person can settle.

## Worth noting
- Review costs a second agent session on every card. That is the price of not reading each diff
  yourself.
- The reviewer can be wrong. It reads the card and the code, so a card that says the wrong thing
  produces work that passes review.
- Two correction rounds by default. After that the run stops and asks you, rather than looping.
- Extra work an agent did that wasn't asked for is removed without asking, when it has no value
  on its own. If it might be valuable, it is removed and proposed as a new card instead.
- Required wiring, configuration and dependencies are not treated as drift. A change with real
  consequences for behaviour, design, security, compatibility or cost becomes a question first.

<!-- agent -->

## Scope
- **Independent review**: a new session with a clean checkout, the approved card, and the run's
  diff. It may read the repository and run checks. It never receives the implementation session's
  transcript or reasoning.
- **Corrections**: clear mistakes go back to the implementer. Allow two rounds by default.
- **Stop conditions**: the same issue returns, no progress is made, the round limit is reached,
  or an agent session fails or is cancelled. On any of these, stop and add an open question
  carrying the evidence and the decision needed.
- **What counts as drift**: a change is drift only when it is clearly unnecessary for the
  approved card. Required wiring, configuration and dependencies are in scope.
- **Clear drift is removed**: an unnecessary change with no meaningful value of its own is
  removed without blocking. Record the correction in the run log.
- **Separable and possibly valuable**: remove it from this implementation and propose a new card.
  Do not block the current one.
- **Unclear scope becomes a question**: if it is unclear whether a change is required, or
  removing it would need a significant choice with a downside, do not call it drift. Add an open
  question and block landing.
- The human then updates the card or approves an exception for that exact implementation, and
  review runs again.
- A separate problem that does not stop the current card from being finished becomes a follow-up
  card, not an open question.
- **A required change with real consequences becomes a question before it is made** — when it
  significantly affects user-visible behaviour, technical design, security, compatibility, or
  ongoing cost.
- **`## Worth noting after implementation`**: a new card section for useful findings that need
  awareness but no decision. It never blocks landing. Routine findings and corrected mistakes
  stay in the run log instead.
- **Card size**: many questions or notes on one card suggests it is too large. Recommend a split;
  the human decides.
- Every review verdict, correction round and stop reason is written to the run's audit record.

## Todo
- [ ] Add a review step that runs after implementation, in a new session with a clean checkout,
      given the approved card and the run's diff and nothing else.
- [ ] Send clear mistakes back for correction, and cap it at two rounds by default.
- [ ] Stop on a repeated issue, no progress, the round limit, or a failed or cancelled session —
      and add an open question with the evidence and the decision needed.
- [ ] Classify unrequested changes: remove clear drift, propose separable valuable work as a new
      card, and raise anything unclear as an open question that blocks landing.
- [ ] Raise a question before making a required change with significant consequences for
      behaviour, design, security, compatibility or cost.
- [ ] Re-run review after the human updates the card or approves an exception.
- [ ] Add `## Worth noting after implementation` to the card format and write findings there.
- [ ] Have review recommend a split when a card collects many questions or notes.
- [ ] Record every verdict, correction round and stop reason on the run's audit record.
- [ ] Document what review does and does not check in `kanban-ui/README.md`.

## Source
- `plan.md`, in commit `1127a91` — "Core workflow" (automatic corrections, identify drift, remove
  clear drift, propose useful follow-up work, ask when scope is unclear, post-implementation
  notes, independent review, task size), and "What the human reviews".
