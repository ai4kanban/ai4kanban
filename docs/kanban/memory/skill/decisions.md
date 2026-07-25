# Decisions

Settled answers to cards' open questions — the question, then the answer, once resolved.
The resolve flow appends here. Read before proposing so you don't re-ask a settled call.

## Memory set

- **How far does "stop maintaining archive.md" go — keep it in the set but unwritten, or
  remove it entirely?** Remove it entirely (option B, the full clean break). The memory
  set drops from six files to five; `archive.md` leaves `init`/`memory-init`, propose
  reads the published docs + `readme.md` instead, and today's `archive.md` lines are
  migrated into the docs before the files are deleted. This reverses the six-file
  decision from #31/#36 — a file nothing writes is exactly the leftover we avoid.

## Auto-refine (#40)

- **How does one card's auto-refine loop run — one session or a process per pass?** One
  session: a single `claude -p` runs the whole loop start to finish, no human in the loop.
  It answers the questions it's sure of, re-reviews, and keeps going until the only
  questions left can't be answered easily — those stay on the card as open questions, then
  the session ends (`ready`, or with open questions for the user).

## Auto-refine (#42)

- **Which confidence levels may auto-answer a question?** Only `high`, for now. `med` and
  `low` both wait for the user. Start with a strict bar; widen later only if it proves
  reliable.
- **Does an auto-answer get recorded in `decisions.md`, or kept card-only?** Kept on the
  card. The answer goes onto the card, in its "what the agent decided on its own" part;
  only a decision that helps future decision-making is appended to `decisions.md`. The
  card's two-part layout — the plan vs. what the agent added — is how the user sees and
  checks what the agent decided, so `decisions.md` stays short instead of holding every
  auto-answer. (This reverses the earlier "record everything, same as the human resolve
  flow" call.)

## Auto-refine switch (#41)

- **Where does the auto-refine on/off setting live?** `docs/kanban/ui.config.json`,
  top-level `autoRefine` boolean, off by default (missing = off). The skill's refine/resolve
  loop reads it before auto-acting. Extends the existing file rather than adding a new one.
- **Is the auto-refine switch #16's "auto-design"?** Yes, same switch — building #41 settles
  #16's auto-design. One on/off switch, not the full autonomy ladder.
