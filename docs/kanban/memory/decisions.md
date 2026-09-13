# Decisions

Settled answers to cards' open questions for the project as a whole — the calls that
aren't any single module's. A module's own decisions live in
`docs/kanban/memory/<module>/decisions.md`, never here.

Keep only **user-facing** calls that still guide future planning — what a user can see,
do, or would care about. Code detail stays on the card. Read before proposing so you
don't re-ask a settled call.

## What local-first promises

- Local-first is a promise about the default backend — markdown in git — not about every
  backend a user can pick.

## How far agents go alone

- There is no single on/off switch for what the board does on its own, and no ladder of
  levels. Work that needs no user follows whatever caused it, and each further step brings
  its own setting if it needs one.
- One click already carries a card from build to landed and archived. Letting the board reject
  a card is a separate feature: nothing today ever decides a card should be rejected.
- A delivery that cannot land does not become a question: the board resolves the conflict and
  lands it itself, and only asks when the work is genuinely at risk.

## Eval collection

- The partner feedback agent is disabled by default and enabled only after the user agrees to
  participate. Once on, concrete issue feedback triggers it to analyze, collect and submit the
  session it came from, uploading only the project files that session read.
- The first collection is for a small group of partners whose code the team may inspect, with
  no upload preview in the first version.
- Curated cases, rubrics, runners and experiment summaries live in the separate private
  repository `ai4kanban-evals`, with the public guide revision recorded per experiment.
  Incoming submissions are reproduced and reviewed before admission.
