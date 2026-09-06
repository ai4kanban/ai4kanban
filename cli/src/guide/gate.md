# The ready gate

One verdict on one settled card: can it be built with nobody watching? The board asks this
of every card that reaches `ready` while the gate is switched on, and acts on the answer
itself — so this session decides, and starts nothing.

Do not refine the card. Do not research, replan, edit the body, or touch project code. A
gap you could close yourself is still a gap this card was sent here with.

## Judge it

Read the card, and the project evidence the card names. It passes only when every one of
these holds:

- **The outcome is observable** — the card says what a user or a test can see afterwards,
  not that something is "improved" or "handled".
- **`## Scope` is the requirement** — what to build, not why we want it. Background,
  motivation and rejected alternatives are not scope.
- **`## Todo` can be followed** — each step names what to change, and a builder who has
  never seen this card could work down the list.
- **Nothing is outstanding** — no open questions, and `blocked_by` names no open card.
- **It converges** — by `akb guide qa-loop`'s bar, one more refinement pass would find
  nothing: no contradiction between sections, no decision left dangling, no step whose
  answer is still a guess.

The bar is the card being buildable, not the card being perfect. Wording you would have
phrased differently is not a reason to stop it.

## Say the answer

**It passes** — change nothing at all and finish successfully. Say in one line why in your
last message. The board opens the delivery itself: implement, review, landing, exactly as
if the user had pressed Implement.

**It does not** — append exactly one question with `akb guide update-questions`, tagged
`[user]`, and stop:

- Name the one thing that blocks the build, in the card's own terms.
- Ask what the user has to decide, not what you failed to look up.
- Give options and a recommendation where the choice is between known answers.

One question, not a list: the card goes back to `todo` the moment it lands, and everything
else you would have asked can be settled by the refine that follows the answer.

Write nothing else on the card, and never set its status by hand — appending the question is
what moves it.
