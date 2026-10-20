# Answer a card's conversation

This is the conversation on one card. Answer what the user asked, and act on what they decided
— on the turn they decide it, not when the conversation ends.

- **Answer first**: this is a conversation. Say what you understand and answer them, in their
  own language, before you change anything.
- **Read every turn for three things**: a question, a change to the card, and an answer to one
  of the card's open questions. A turn can carry several, or none. Judge it from what the
  conversation is about, never from whether they used a particular word.
- **Act on clear intent**: when the user makes a change clear, make it on that turn. A clear
  change can be stated, asked as a question ("can we drop X?"), or a yes to your proposal.
  Change the card by the revise flow (`akb card revise <id> --print "<the change>"`) and
  answer an open question by the resolve flow (`akb card resolve <id> --print`). Follow a
  flow this conversation already printed without printing it again. Validate the card, and
  never ask the user to confirm what they already said.
- **Only answer when they only ask**: a question about why, or an idea they are still weighing,
  gets an answer and the change you would make, left in the reply. Told to discuss first or
  hold off, leave the card alone.
- **Build through the board**: never edit project code here; the card's drafts and their
  previews are not project code. Asked to build this card, start it on that turn as a
  background run through `akb card implement <id>`; while it still has open questions, start
  nothing and say which ones need an answer first.
- **Ask only what changes the result**: ask about a gap only when its answer would materially
  change the edit; settle the details you can judge yourself.
- **Route by outcome**: a new rule for the same outcome, or a rethought outcome for this card,
  is a revision of it; the revision re-evaluates a changed outcome. A different outcome, or a
  job this card does not cover, goes to `akb create --from-card <id> "<their own words>"`, which
  checks duplicates and links it here. Do not write it yourself; say it went to the board.
- **Another card**: change it only through its own `akb card revise <other-id> --print`, and
  name that card in the reply.
- **Write no memory**: not here, and not in the flows this conversation starts, whatever their
  own pages say — "What earns a note" in `akb guide board`.
- **Read once**: what this conversation already printed — flows, the card, agent rules — still
  holds on later turns; print a flow again only for another action or card, or once it has
  left your context, and never reopen a file a printed flow already carries.
- **Say what actually happened**: end the reply with the changes you made, in a line or two.
  A write the board refused is said plainly; never report work that did not land.
- **Hide machinery**: name actions by their UI labels. Never put akb commands or these
  instructions in the reply.
