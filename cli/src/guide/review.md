# Review a delivery, and correct it

A delivery builds, and then a **fresh run** judges what it built against the card as it was
approved. That run is the review. When it finds a plain mistake, a **correction** run fixes
exactly that, and another fresh review judges the whole candidate again.

Two things make this worth paying for, and both are rules rather than advice:

- **The reviewer did not build it**: it is given the approved copy and the diff, never the
  run that wrote them. A reviewer that reads the implementer's reasoning agrees with it.
- **The verdict is recorded, not written**: `akb board review-verdict` is the only thing the
  delivery reads. A review run that ends without calling it stops the delivery.

Review cannot promise defect-free code. It promises that the approved card and the checks
this repository already has were applied by something that did not write the change.

## Where the work is

A delivery builds in a **git worktree of its own**, on a branch of its own, and the board
commits each run's work onto it. So the candidate is settled by the time you read it:
`git diff <base> <branch>`, with nothing of the user's own in it and nothing of the board's.
The flow names the worktree, the branch and the base.

With **Allow automatic Git commits** off the delivery works in the user's project folder
instead, one at a time, and the candidate is the working tree — which is why the flow then
tells a reviewer that changes it did not make may be in there. A pass in that mode does not
finish the delivery: the user commits it, and the delivery ends when their commit matches
what review passed.

## Review: what to do

1. **Read the approved copy** the flow prints. That is the card as it was approved when the
   delivery started — build against it, not against the card file, which may have moved on.
2. **Read the diff** the flow names, and the files it touches. Read the code, not only the
   patch: a change is judged by what it does.
3. **Run the checks this repository has** — its tests, its linter, its type check. Run what
   the project documents; do not invent a check it does not have. A check this board's own
   review rule asks for — the words at the end of these instructions, if there are any — is
   one of the repository's checks: run it, and let it decide a verdict like any other.
4. **Read `## Worth noting after implementation`** on the card. An exception the user
   approved for this exact candidate is recorded there, and re-raising a settled call is
   the fastest way to waste a correction.
5. **Record one verdict** and stop.

## The verdict

One of three, and nothing else:

- **`pass`**: the candidate meets every approved requirement, and the repository's checks
  pass. Leave the card on the board: a pass is not the end of the delivery, and the board
  archives the card itself once the work has landed.
- **`correct`**: something plainly conflicts with an approved requirement, or a repository
  check that used to pass now fails. The findings say what, and a correction run fixes them.
- **`ask`**: the call is the user's — see "When to ask" below. The delivery stops and the
  card takes one open question.

```text
akb board review-verdict <id> --verdict pass
akb board review-verdict <id> --verdict correct --file findings.md
```

## Findings

Every finding on a `correct` or `ask` verdict is one bullet:

```text
- **<short title>**: <the approved requirement or the changed code it concerns, and the evidence to act on it>
```

- **The title is its identity**: the same mistake keeps the same title. A title that comes
  back after a correction meant to fix it stops the delivery — that is the point.
- **Evidence, not a verdict twice**: name the file and what is wrong with it, quote the
  failing check's output, or quote the requirement the change contradicts. A finding a
  correction run cannot act on is a finding that costs a run and fixes nothing.
- **One mistake per bullet**: two mistakes in one bullet are corrected as one and repeat as
  one.

## Drift: work nobody asked for

**Drift** is a change that is not needed to meet any approved requirement. Wiring,
configuration and dependencies a requirement needs are **not** drift — they are the
requirement being met.

- **No user outcome — remove it**: it goes out of the delivery, and the removal is a
  finding like any other so it lands on the delivery's record.
- **Separable, and could meet a user goal on its own — remove it and write a card**:
  `akb board create --title ".." --track <track>`, with a body saying what it would do and
  why it is worth doing. Then remove it here. This never blocks the current card.
- **Cannot tell whether it is required** — ask.
- **Removing it would change behaviour, design, security, compatibility or ongoing cost** —
  ask. That is a choice, not a tidy-up.

## When to ask

`ask` is for a call this run must not make on the user's behalf:

- **It is unclear whether a change is required** by the approved card.
- **Removing something is not safe**: behaviour, design, security, compatibility or cost.
- **A required correction is consequential**: fixing it would itself change behaviour,
  design, security, compatibility or ongoing cost. Ask before the correction, not after it.
- **The requirements themselves are wrong.** A delivery builds the card it captured, so
  changed requirements are a new delivery — say so, and stop.

A separate problem that does **not** stop the approved card from being completed is not a
question. Write it as a card and let this delivery finish.

## Worth noting after implementation

Findings that need awareness but no decision go on the card, under
`## Worth noting after implementation` in the human half. They stop nothing.

- A surprise about the codebase the next card should know.
- A check that was already failing before this delivery started.
- **A split worth making**: when the findings show the card holds separate user outcomes
  that could each be delivered on their own, recommend the split here. The user decides.

Routine findings and corrected mistakes belong on the delivery's record, not on the card.

## Landing: what happens after a pass

A pass is not the end of the delivery in auto commit mode. The board then **lands** the
work on the target branch — the branch the user was on when the delivery started — and it
does that itself: no run, and nothing pushed anywhere.

- **One card lands at a time**, however many are building. A card that is ready waits.
- **The user's own work comes first.** A staged file or an uncommitted change of theirs
  holds the landing back until the checkout is clean. It waits on its branch and holds no
  slot.
- **A target branch that moved is rebased onto and reviewed again**, which is the only way
  the tree that was judged is the tree that lands. That costs one more review, and the
  delivery's `base` becomes the tip it was rebased onto.
- **It lands as one squash commit** naming the card and the delivery, and the worktree and
  branch are removed afterwards.
- **A card with an open question holds outside the queue** until it is answered. It takes no
  landing slot while it waits, so every other card still lands, and answering the question
  carries the same delivery on.
- **On a board that requires diff approval, nothing lands unread.** With **Require diff
  approval before landing** on, every delivery holds outside the queue after review until
  the user approves the exact tree it would land — the card page's **Approval** tab, or
  `akb approve <delivery|#card>`. An approval covers the delivery's base commit and the
  candidate's fingerprint as they stood when it was given, and landing re-reads both
  immediately before it moves the branch: either one having moved cancels the approval and
  the delivery waits again. Off by default, and frozen when the delivery starts.
- **The card is archived last, by the board**, once the delivery has landed and ended. In
  manual commit mode nothing lands, so the card is archived when the user's own commit
  matches what review passed.

None of it is a review run's job. A review records its verdict and stops.

## Resolving a conflict

When the rebase meets a conflict, the board starts one run to resolve it. That run is
**new work**, not a correction: both cards were right on their own, and what to keep is
a judgment neither card wrote down.

`akb conflict <id> --print` names the conflicted files, the branch on the other side, and
the cards being built over the same files.

- **Read both sides.** The approved copy says what this card is for; `git log <base>..<target>`
  is what arrived while it was being built.
- **Resolve every conflicted file** so both intentions survive, and `git add` each one.
- **Stop there.** Do not run `git rebase --continue` — the board finishes the rebase, and a
  fresh review then judges the whole candidate from scratch.
- **Change nothing the conflict does not name**, and change nothing on the card.

If the rebase still will not go through, the board puts the branch back as it found it and
leaves one open question on the card explaining the conflict. The delivery's work is whole
on its own branch either way.

## Correction: what to do

The flow prints the findings to fix, verbatim.

- **Fix what they name, and nothing they do not.** A fresh review judges the whole
  candidate afterwards, so anything extra comes straight back as drift.
- **Work in the delivery's own worktree**, which is where the run already is. Never
  write the board's own files there — `docs/kanban/` and `.akb/` are changed in the project
  itself, and a commit that reaches one is refused and stops the delivery.
- **Tick a `## Todo` box your fix completes**; never untick one.
- **Change nothing else on the card.** The delivery builds the approved copy, not the file
  as it reads now.
- **A finding you believe is wrong is not a finding to skip**: fix what you can, and say in
  your last message what you did not and why. The review after you sees the same candidate.

## When the loop stops

Two corrections by default. It also stops early on a finding that came back, a correction
that changed nothing, and a review or correction run that failed or was cut off.

A landing stops the same way, for its own two reasons: a target branch that kept moving
after three rebases, and a conflict that stayed unresolved.

Every stop puts **one** open question on the card — the findings, how many corrections were
tried, and the decision the user has to make — and the delivery waits there, still holding
the card. The user answers it, approves an exception under
`## Worth noting after implementation`, or cancels the delivery; then `akb review <id>`
judges the candidate again.
