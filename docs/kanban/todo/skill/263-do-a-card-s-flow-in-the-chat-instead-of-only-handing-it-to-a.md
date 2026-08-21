---
title: Do a card's flow in the chat, instead of only handing it to a run
track: skill
priority: high
roi: high
status: ready
release: 0.7.1
blocked_by: []
related: [264, 265]
modules: [skill, local-ui]
questions: []
verify:
  - run a refine from the app's chat rail on a real card, and see how long the reply takes with nothing to watch and no way to stop it
---
Ask the chat to sharpen a card and it hands the job to a background run. The user is sitting
right there, in the conversation that raised it, and now waits on a second agent that starts
knowing nothing about it. To correct that agent they throw the run away and start again.

## Today
- Say "refine #12" in the chat and a background run starts. The user watches a log for work
  they asked for in the conversation they are already in.
- The same sentence to a coding agent that has the board's skill does the refine there and
  then, and the user fixes it by replying rather than by starting over.

## Scope
- **Only three flows are ever done in the chat**: sharpening a vague card, answering its open
  questions, and working out a rewrite the conversation has not settled yet.
- **The chat never asks which way to go.**
- **It reads the card and picks, ask by ask.**
- **It does the flow here when the flow will end in a decision only the user can make** —
  taste, priority, direction. The three flows above usually will.
- **It starts a run when the flow will not.** Answering questions that are all settled by
  going and looking ends in answers, not in a decision, so it is a run.
- **When the user says which way they want it, that wins**: "do it here" or "run it" is
  followed, whatever the chat would have picked.
- **The chat never builds a card, whatever the user says.** Building a card means writing
  this project's code.
- **These start a run unless the user says otherwise**: a spec agent filling part of a card,
  setting the board up, one pass of a card that repeats, proposing the next tasks, and
  filling a release.
- **A chat carries the flow out in the reply itself, start to finish.**
- **What it cannot settle it leaves as open questions on the card**, exactly as a run does.
- **The card comes out exactly as the run would have written it** — same fields, same body.
- **A reply that did the work here is a few lines**: what changed, and what is still open.
- **Every reply says which way it went** — done here, or the run it started.
- **The next message carries on from what was just done.** The conversation still has it, so
  a correction is one more message.
- **The rail in the app and `akb chat` in a terminal follow the same rules.**

### Holding the card
- **One card is held per reply** — the one whose flow that reply is carrying out.
- **The reply names that card before it starts.**
- **Nothing outside that reply may change a held card**: not a run, not the card's own
  buttons, not a second conversation.
- **A refusal names what has the card.** There are two conversations to name: the board's
  chat, and the card's own chat.
- **A held card's buttons go grey in the app**, the way they do while a run holds it.
- **A card a run already holds is refused to the chat too.** The reply says which run has it
  rather than starting another.
- **The hold lasts exactly as long as the reply.** A conversation that went away — stopped,
  failed, the app closed — holds nothing.
- **A flow cut off part-way leaves the card as it stands at that moment**, the same as a run
  that was stopped.
- **A change the conversation has already settled takes no hold**: a reword, an archive, a
  release.

## Scope out
- The chat still never writes this project's code.
- No change to the Resolve dialog. Questions answered in the chat are cleared from the card
  the same way; the dialog stays for anyone who never opens the chat.
- Nothing new for talking to a run once it is going — see
  `docs/kanban/memory/local-ui/rejected.md`.

## Todo
- [ ] Let a chat sharpen a card, answer its questions, or work out a rewrite in the
      conversation, instead of starting a run for it.
- [ ] Have the chat read the card and pick between doing it here and starting a run.
- [ ] Keep every other flow a run, and never build a card in the chat.
- [ ] Follow the user when they say which way they want it.
- [ ] Write the card at the end exactly as the run would have.
- [ ] Hold the card whose flow a reply is carrying out.
- [ ] Refuse a run, a button and a second conversation on a held card, in a line naming what
      has it.
- [ ] Grey a held card's buttons in the app, the way they grey for a run.
- [ ] Let go of the hold when the reply ends — finished, stopped, failed, or the app gone.
- [ ] Tell the user which run has the card when one already holds it, instead of starting
      another.
- [ ] Say in every reply which way it went, what changed, and what was left open.
- [ ] Cover it in `docs/guides/daily-loop.md`, `cli/README.md` and `kanban-ui/README.md`:
      what talking a card through gets you that sending it off does not.

## Decided by the agent
- What does "ends in a decision only the user can make" mean? What the flow *ends in*, judged
  from the card before it starts — not what turns up once the work is under way.
- Why does a spec agent always start a run? It is worth asking for precisely because it
  starts clean; written in the conversation that wanted it, it is that conversation's own
  opinion under another name.
- Why is setting the board up always a run? It is a long job with many steps, and the app
  already drives it as a guided first run.
- Why do proposing tasks and filling a release stay runs? They write across the whole board
  and hold no card, so nothing would keep a run from doing the same work at the same moment.
- Why is one pass of a repeating card always a run? Its steps are written never to wait for
  an answer, so a pass never ends in a decision waiting on the user.
- Why is a reply that did the work only a few lines? The card is the record, not the reply.
- Which card does a reply hold? The one whose flow it is carrying out. A reply can touch
  several cards, so holding every card it might read would lock the board for a whole
  conversation.
- How does a hold end when nobody ends it? The board asks whether the reply is still coming.
  Nothing has to be cleared, so a closed app leaves no card refusing work.
- Why does a settled change take no hold? A reword or an archive is over in the moment it
  takes; a hold would be gone before anything could collide with it.

### Worth noting
- A flow done in the chat leaves no entry in the runs panel. A run is something you follow,
  stop and resume, and there is none of that here; the card and the conversation are the
  record.
- The user's word overrides the chat's pick, and reaches the always-a-run list too, so "set
  the board up here" is obeyed. Refusing it would mean the chat knows better than the person
  who asked. Only building a card is beyond it, because that is code.
- A held card's buttons grey out. A hold nobody can see reads as a button that quietly does
  nothing.
- A second conversation is turned away rather than queued. Two chats on one card is rare, and
  a refusal naming the other one is easier to act on than a wait with no end in sight.
- This ships before the app can stop a reply mid-flight (#267). A terminal already stops one
  with Ctrl-C, the hold ends with the reply, and a cut-off flow leaves the card where a
  stopped run would.
