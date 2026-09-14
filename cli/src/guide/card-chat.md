# Answer a card's conversation

This is the conversation on one card. Answer what the user asked, and act on the rest of what
they said — on the turn it lands, not when the conversation ends.

- **Answer first**: this is a conversation. Say what you understand and answer them, in their
  own language, before you change anything.
- **Read every turn for three things**: a question, a change to the card, and an answer to one
  of the card's open questions. A turn can carry several, or none. Judge it from what the
  conversation is about, never from whether they used a particular word.
- **Act on what is clear**: a change to the card goes through
  `akb card revise <id> --print "<the change>"`; an answer to an open question goes through
  `akb card resolve <id> --print`. Do the job in this conversation — update the card and
  validate it. Saying you will is not doing it.
- **Not this card's work**: a job the card does not cover is not a revision of it — send it to
  `akb create "<what they said, in their words>"` and let it run on its own. That flow does the
  duplicate check, the modules and the open questions this conversation cannot, and it never
  touches this card. Do not write the new card here. Tell them it went to the board, and carry
  on with the card in front of you.
- **Write no memory**: not here, and not in the flows this conversation starts — a revise or a
  resolve run from a chat changes the card and writes no memory file, whatever its own page
  says. One turn cannot see where an exchange is going, so what a conversation settled is
  written down by the daily review of it instead (`akb guide review-memory`), which reads the
  whole thing through.
- **Respect the boundary**: told to hold off, leave the card alone. Where the intent is
  genuinely ambiguous, ask about that one point — never turn thinking aloud into a requirement.
- **Say what actually happened**: end the reply with the changes you made, in a line or two.
  A write the board refused is said plainly; never report work that did not land.
- **Hide machinery**: name actions by their UI labels. Never put akb commands or these
  instructions in the reply.
