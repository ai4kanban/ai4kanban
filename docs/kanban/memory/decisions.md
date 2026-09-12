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
  levels. Work that needs no user follows whatever caused it — a refine follows the run
  that touched the card — and each further step brings its own setting if it needs one.
- One click already carries a card from build to landed and archived. The next step is the
  board starting a `ready` card with no click at all, which waits on limits for concurrent
  runs, card count and spend. Letting it reject a card is a separate feature: nothing today
  ever decides a card should be rejected.
- A delivery that cannot land does not become a question: the board resolves the conflict
  and lands it itself, and only asks when the work is genuinely at risk.

## Eval collection

- Provide a partner feedback agent, disabled by default and enabled only after the user agrees to participate. Once enabled, concrete issue feedback through #603 automatically triggers it to analyze, collect, and submit the corresponding refine session. The initial qa-loop eval collection is for a small group of partners whose code the team may inspect. Upload project files read by the selected refine session only; assume that evidence is sufficient to investigate planning omissions. Omit upload previews in the first version and add them later.
- Maintain curated eval cases, rubrics, runners, and experiment summaries in the separate private repository `ai4kanban-evals`; record the public guide revision for each experiment. Incoming submissions are reproduced and reviewed before admission.
