---
title: Make one Implement click carry a card all the way to landed
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [303, 304]
related: [300]
modules: [local-ui, skill]
questions:
  - question: "[user] Which layout for the card page's delivery and approval states? — see the `ui-design` section"
    mode: single
    options:
      - A — one delivery panel under the buttons holding the waiting line, the diff and the approval; costs page height above the card's own words
      - B — the state on the title band, the diff and approval behind tabs in the delivery block
      - C — one waiting line at the top, the diff and approval below the four approved parts
    recommend: [1]
---

The pieces exist by now but nothing joins them: a click still means implement, and the user drives
the rest. Make one click on a card carry it through implementation, review, corrections, landing
and completion, pausing only for a failed check or a decision only a person can make. Say clearly
what that click is approving, and what a paused card is waiting for.

## Worth noting
- **What does one click do?**: puts the change on the target branch, then finishes the card — its
  todos ticked, its shipped line written, the card archived. Nothing asks you again in between.
- **What are you approving?**: the card, not the diff — what it should achieve, what to weigh, its
  open questions, and what turned up while it was built. A board that wants diff approval turns
  that on separately (#308).
- **Can you still click it on a card with open questions?**: yes, with a warning. The card is built
  and reviewed, and then holds at landing until the questions are answered.
- **Do you click again after a pause?**: no. Answering the thing a delivery is waiting on
  continues it. An answer that changes what the card asks for starts a fresh delivery instead.
- **Is there an exception?**: manual commit mode, where the flow stops after review and waits for
  you.
- **What does a paused card tell you?**: which specific thing it is waiting on — an unresolved
  question, a pending approval, or manual mode. It reads **Delivery in progress** until then, and
  **Landed as `abc123`** after.

## By `ui-design` agent

### The screen

Each option draws the card page in the state a delivery leaves it in, and the dialog that starts
one. All three carry the same content, and differ only in where the delivery's state sits:

- **The four approved parts, together and unfolded**: the task summary, `## Worth noting`, the open
  questions and `## Worth noting after implementation`, in one panel, none of it folded away.
- **One line naming what the delivery waits on**: an unresolved question, a pending approval, or
  manual commit mode.
- **The manual-commit states**: **Waiting for your commit** with the reviewed diff and "Commit these
  changes in your editor or terminal, then return here", and **Code changed after review** while a
  changed commit is reviewed again.
- **The rewritten Implement dialog**: what the one click does in order, naming the branch it lands
  on; the open-question warning beside **Resolve & implement**; and the line saying the delivery
  stops after review in manual commit mode.

Where the state sits is also where #305's diff and #308's approval have to fit later, so each option
draws the diff where it would go and marks the approval's place.

<Mockup src=".mockups/307/a.tsx" label="A" />

A delivery panel of its own under the card's buttons — the waiting line, the instruction that
answers it, the reviewed diff and the approval's slot in one block. Good when the pause is why the
page was opened; it costs height, since the card's own words start a panel lower whenever a
delivery is live.

<Mockup src=".mockups/307/b.tsx" label="B" />

The state rides the title band as a pill with its line under it, and the session-log block already
on the page grows tabs — Diff, Log, Approval. Good for adding no new furniture; it costs a click,
because the diff and the approval sit behind a tab, away from the line that says they are waiting.

<Mockup src=".mockups/307/c.tsx" label="C" />

One tinted line under the buttons, and the delivery's panel at the end of the page, after
everything the approval covers. Good for reading order — you reach the action having read what it
covers; it costs reach, since on a longer card the diff and its approve button are below the fold.

**Recommended: A.** A pause is one sentence — what the delivery waits on, the evidence it waits
with, and the control that answers it — and A is the only option that keeps all three in one block,
which is also the single home #305 and #308 both ask for. B hides the evidence behind a tab and C
puts it a page away.

<!-- agent -->

## Scope
- **One click, all the way**: one click starts one delivery — implementation, review, corrections,
  landing and completion, in that order. It pauses only for a failed check or a human decision.
- **Open questions warn, and hold the card at landing**: the Implement dialog warns when the card
  has open questions, the way it already warns on a blocker, and offers **Resolve & implement**
  beside it. Going ahead builds and reviews the card; landing waits until nothing is left to
  answer.
- **`Resolve & implement` starts the same delivery**, carrying a card all the way once its
  questions settle.
- **Completion is the last step, never an earlier one**: after landing, tick the card's todos,
  write its shipped line in the module's `readme.md`, and archive it. A card whose code has not
  landed is never completed.
- **Completion is a card update like any other**: the todos, the shipped line and the archive
  move, made the way a flow makes every other card change.
- **The Implement dialog says what the click will do**: it names the target branch the change will
  land on, and says instead that the delivery stops after review when manual commit mode is on.
- **The four parts a human reviews are shown together and unfolded**: the task summary,
  `## Worth noting`, open questions, and `## Worth noting after implementation`. That last section
  sits in the human half, above the `<!-- agent -->` boundary, so the card page never folds away
  part of what approval covers.
- **A paused card says what it waits on**, in one line on the card page: an unresolved question, a
  pending approval, or manual commit mode.
- **Answering a pause continues the same delivery** from where it stopped. An answer that changes
  the card's requirements starts a new delivery on them instead, and the card page says which
  happened.
- **Waiting UI**: after review in manual commit mode, the card page shows **Waiting for your
  commit**, the reviewed diff, and "Commit these changes in your editor or terminal, then return
  here."
- **Code changed after review**: when the user's commit differs from the reviewed snapshot, the
  card page shows **Code changed after review** while the fresh review #303 asks for runs.
- **Each click starts one delivery**, and several cards may have an active delivery at the same
  time.
- **`akb implement <id>` starts the same delivery**, so a board driven from a terminal behaves like
  one driven from the app.
- **Pause states are derived, not stored** — from unresolved questions, pending approval, or
  manual mode.

## Todo
- [ ] Join implementation, review, correction, landing and completion into one action behind the
      Implement click.
- [ ] Warn in the Implement dialog when the card has open questions, offer **Resolve & implement**
      beside it, and hold such a card at landing until they are answered.
- [ ] Give **Resolve & implement** the same one-click flow.
- [ ] Run completion after landing — tick the todos, write the shipped line, archive the card —
      and never before the code has landed.
- [ ] Rewrite the Implement dialog: name the target branch the change will land on, and say the
      delivery stops after review when manual commit mode is on.
- [ ] Move `## Worth noting after implementation` into the human half, and show all four approved
      parts unfolded on the card page.
- [ ] Pause only on a failed check or a decision for the human, and say on the card page which
      one.
- [ ] Continue the paused delivery from where it stopped once the pause is answered, and start a
      fresh one instead when the answer changed the card's requirements.
- [ ] Show **Waiting for your commit** with the reviewed diff in manual commit mode, and **Code
      changed after review** while a changed commit is reviewed again.
- [ ] Give `akb implement <id>` the same one-click delivery the app has.
- [ ] Derive the pause state from unresolved questions, pending approval or manual mode rather
      than storing it.
- [ ] Update `kanban-ui/README.md` and `docs/guides/daily-loop.md` — what one click now does, and
      that a build now ends with the card landed and archived rather than with "#4 is done".

## Scope out
- **No detection of the user's commit**: #303 finds it and compares it with the reviewed snapshot.
  This card shows the result.

## Decided by the agent
- **Why does an open question warn rather than refuse?**: the Implement dialog already lets a user
  overrule a warning, because they know things the board does not. An open question is not a
  reason to refuse a build — it is a reason not to land one, which is where the flow already
  stops.
- **Why does answering a pause need no second click?**: a pause is a stop inside one click, not
  the end of it. Answering the thing the delivery waits on is the deliberate act that continues
  it.
- **Why is completion moved behind landing?**: today an implement session archives the card at its
  close, before anything has been committed. Left there, a card would leave the board while its
  code could still fail review or wait for a conflict.
- **Why is the landing page not updated here?**: the site's claims about runs and commits are
  rewritten by #303, where the setting they describe lands.

## Source
- `plan.md`, in commit `1127a91` — "What the human reviews", "Core workflow" (one-click flow,
  survive interruptions), and "Manual commit mode" under "Parallel work with Git worktrees".
