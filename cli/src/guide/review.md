# Review a delivery, and correct it

A delivery builds, and then a **fresh session** judges what it built against the card as it
was approved. That session is the review. When it finds a plain mistake, a **correction**
session fixes exactly that, and another fresh review judges the whole candidate again.

Two things make this worth paying for, and both are rules rather than advice:

- **The reviewer did not build it**: it is given the approved copy and the diff, never the
  session that wrote them. A reviewer that reads the implementer's reasoning agrees with it.
- **The verdict is recorded, not written**: `akb board review-verdict` is the only thing the
  delivery reads. A review session that ends without calling it stops the delivery.

Review cannot promise defect-free code. It promises that the approved card and the checks
this repository already has were applied by something that did not write the change.

## Review: what to do

1. **Read the approved copy** the flow prints. That is the card as it was approved when the
   delivery started — build against it, not against the card file, which may have moved on.
2. **Read the diff** the flow names, and the files it touches. Read the code, not only the
   patch: a change is judged by what it does.
3. **Run the checks this repository has** — its tests, its linter, its type check. Run what
   the project documents; do not invent a check it does not have.
4. **Read `## Worth noting after implementation`** on the card. An exception the user
   approved for this exact candidate is recorded there, and re-raising a settled call is
   the fastest way to waste a correction.
5. **Record one verdict** and stop.

## The verdict

One of three, and nothing else:

- **`pass`**: the candidate meets every approved requirement, and the repository's checks
  pass. The delivery is finished, and this session archives the card.
- **`correct`**: something plainly conflicts with an approved requirement, or a repository
  check that used to pass now fails. The findings say what, and a correction session fixes
  them.
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
  correction session cannot act on is a finding that costs a session and fixes nothing.
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

`ask` is for a call this session must not make on the user's behalf:

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

## Correction: what to do

The flow prints the findings to fix, verbatim.

- **Fix what they name, and nothing they do not.** A fresh review judges the whole
  candidate afterwards, so anything extra comes straight back as drift.
- **Tick a `## Todo` box your fix completes**; never untick one.
- **Change nothing else on the card.** The delivery builds the approved copy, not the file
  as it reads now.
- **A finding you believe is wrong is not a finding to skip**: fix what you can, and say in
  your last message what you did not and why. The review after you sees the same candidate.

## When the loop stops

Two corrections by default. It also stops early on a finding that came back, a correction
that changed nothing, and a review or correction session that failed or was cut off.

Every stop puts **one** open question on the card — the findings, how many corrections were
tried, and the decision the user has to make — and the delivery waits there, still holding
the card. The user answers it, approves an exception under
`## Worth noting after implementation`, or cancels the delivery; then `akb review <id>`
judges the candidate again.
