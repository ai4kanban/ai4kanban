---
title: Keep past conversations instead of only throwing them away
track: features
priority: low
roi: med
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions:
  - question: "[user] Which layout for past conversations in the chat rail? — see the `ui-design` section"
    mode: single
    options:
      - C — the rail turns into the list; cheapest on the header, but the current conversation is off screen while you browse
      - A — a ⋯ menu in the header
      - B — a second header line, always there
    recommend: [1]
verify:
  - start a new conversation on a card, then reopen the one before it — the transcript should still be there, and `akb chat <id>` in a terminal should be on the new one
  - switch the harness in Configuration to a different agent, then check the past conversation is still listed and readable instead of demanding a delete
  - open a past conversation while a reply is coming in the current one — the reply should still land in the current conversation, and leaving the past one should come back to it
  - delete the current conversation from the bin — the chat should be empty and ready for a first message, with the past ones still listed
  - start eleven conversations on one card — the oldest should be gone from the list without asking
---

A conversation can only be thrown away. So the user keeps a stale one rather than lose what
was said in it, and a chat about a card carries weeks of unrelated context into every new
question.

## Worth noting
- One conversation is live at a time, with the older ones behind it in a list. A tab strip
  of several at once would break the rule that `akb chat` in a terminal and the rail are on
  the same conversation.
- "New conversation" throws nothing away, so transcripts pile up on disk until the bound
  drops the oldest. Deleting one is still a deliberate act.
- The rail cannot tell in advance whether an old conversation can be carried on. The
  agent's session id may have expired on its side, and that only shows when the next
  message fails, so the list carries no "expired" mark.
- Ten conversations are kept for each card and ten for the board, the current one among
  them. Past that the oldest goes without asking, and the number is fixed rather than a
  setting.
- Taking a card off the board still takes every conversation about it, the past ones
  included.
- Deleting the current conversation leaves the chat empty rather than making the newest
  past one current again. Getting back to that one is a deliberate "carry it on".

## By `ui-design` agent

### The screen

The chat rail, at its default 360px. Everything this card adds hangs off the rail's header
row, which today holds an icon, `Chat`, the card id, a bin and a fold `X` in 30px — and
which #272 also wants for a model picker. So the first thing each option decides is where
the room comes from.

Two states are drawn per option: the list of past conversations open, and a past
conversation being read.

### What a row in the list says

- **When it was, in words**: `Today 09:40`, `Yesterday 18:20`, `14 Aug`. No id, no name.
- **The line it opened with**, on its own line under that, cut off at the right rather than
  wrapped — one row is one conversation, always the same height.
- **How many messages**, right-aligned on the top line: `12 messages`.
- **The agent, only where it differs** from the one this board runs now: a small mono chip
  in peach beside the date. The agent this board runs is never named — every row would
  carry it and it would say nothing.
- **Nothing marks a conversation as expired.** The card is right that the rail cannot know;
  the failure arrives as the message that fails, in the strip the rail already uses.

### Reading a past one

- **It is unmistakably not the current one**: the way back is at the top and always in the
  same place, and the box at the foot is either gone or plainly shut.
- **Carrying it on is a button of its own**, never the act of opening.
- **Nothing about the current conversation is disturbed** — a reply still coming carries on
  behind, and coming back finds it where it was.

### Empty and refused

- **No past conversations yet**: the list control is absent, not an empty panel. "New
  conversation" is still there.
- **While a reply is coming**: "New conversation" and "Carry it on" are shut and say why in
  the words the box already uses. Opening a past one to read is always allowed.
- **Under the list**: `Ten are kept for this card. The oldest goes when an eleventh
  starts.` — the bound said once, where it is about to bite.

### The options

<Mockup src=".mockups/273/a.tsx" label="A" />
A `⋯` menu in the header holds everything: `＋ New conversation` on top, the past ones under
it, `Delete this conversation` at the foot, and the bin leaves the header to make room. It
costs the header nothing but one button and touches no other pixel of the rail — the price
is that history lives two clicks deep in a menu no more than 292px wide, so a first line is
cut short, and reading a past one is signalled only by a strip above the transcript.

<Mockup src=".mockups/273/b.tsx" label="B" />
A second line under the header, always there: `＋ New`, `Past 4`, and #272's model chip
moved down into it, which is what makes the first line fit again. The list drops open inside
the rail's own width and pushes the conversation down rather than covering it, and while a
past one is read that same line becomes `← Back · 14 Aug · 31 messages · Carry it on` with
the box below shut and saying so. Both actions are one click and always visible — the cost
is 28px of the rail's height given up permanently, on the app's most vertical surface.

<Mockup src=".mockups/273/c.tsx" label="C" />
One clock button in the header turns the whole rail into its conversations: a full-width
`＋ New conversation` at the top, the current one marked, the past ones under it as cards
with room for a whole first line. Opening one fills the rail with the transcript, a `←`
line naming it, and one `Carry it on` button where the box used to be. The header gains a
single 24px button and the bin moves to the conversation it deletes — the cost is that the
current conversation is off screen while you browse, and getting back is a click.

**Recommended: C.** The header is the scarce thing on this card and C spends the least of
it — one button, against B's whole extra line and A's menu that still has to swallow the
bin. It is also the only one where the list gets the rail's full width, so the first line
that identifies a conversation is readable rather than truncated, and the only one where
read-only is a state of the whole rail instead of a strip or a greyed box: there is no
composer to type into by mistake. Losing sight of the current conversation while browsing
is the real cost, and it is the cheapest of the three.

<!-- agent -->

## Today
- One transcript for each card and one for the board, named by what it is about (`keyOf` in
  `cli/src/lib/agent/chat.ts`). Nothing older than the current one is kept.
- The bin in the rail's header clears the conversation, and it is gone — the file and the
  agent's session id with it. `akb chat --clear` does the same from a terminal.
- A conversation held with an agent this board no longer runs is refused with "clear it to
  start fresh", so the only way past it is to throw it away.
- Taking a card off the board drops that card's conversation (`dropChats` in
  `cli/src/commands/remove.ts`).
- The local UI reaches conversations only through the command (`readChatView`, `clearChat`
  in `cli/src/kanban.ts`), so whatever the rail lists has to exist in the command first.
- The board already bounds a growing record this way: the newest 30 runs and 30 logs are
  kept and the rest dropped (`KEEP_RUNS` in `cli/src/lib/agent/sessions.ts`).
- A coding agent's own chat lists past sessions and picks one back up.

## Scope
- **Start fresh without losing the last one**: a "new conversation" that puts the current
  one behind it rather than deleting it.
- **A list of what came before**, reached from the rail's header: when it was, its first
  line, and how many messages. It names the agent a conversation was held with when that is
  not the agent the board runs now.
- **Read a past one without disturbing the current one**: opening it shows the transcript
  and sends nothing.
- **Go back to the current conversation**: leaving a past one returns to the current
  conversation, with whatever was typed in the box still there.
- **Carry a past one on as a separate action**: it becomes the current conversation, and
  the one it replaces goes behind it.
- **Say plainly when a past conversation cannot be carried on**: where the agent's session
  id has expired, the next message fails and the rail explains that the conversation can
  still be read but not continued.
- **Deleting still works, one conversation at a time**, with the confirmation the bin has
  now, and from a terminal as well.
- **Deleting the current conversation leaves an empty one**: the chat is ready for a first
  message, and the past ones stay in the list untouched.
- **A different agent no longer forces a delete**: a conversation held with an agent this
  board no longer runs stays in the list, and the way past it is a new conversation.
- **Nothing changes the current conversation while a reply is coming**: starting a new one
  and carrying a past one on are both refused in the words the box already uses. Reading a
  past one is always allowed, and a reply arriving while it is open still lands in the
  current conversation.
- **Starting a new conversation with nothing said yet does nothing**: an empty current
  conversation is never put behind, so the list never fills with blank entries.
- **The mark on the Chat button is about the current conversation only**: a reply already
  read in a past conversation never brings it back.
- **Same in a terminal**: `akb chat` continues whatever the rail shows as current, and
  starting a new conversation, listing the past ones and reading one back are commands too
  — `akb chat [<id>] --new`, `--list`, and `--open <short-id>`, with `--clear` taking an
  optional `<short-id>` to delete one past conversation instead of the current one.
- **Each conversation has a short id**: `--list` shows it and the other terminal options
  take it. The rail's list identifies a conversation by when it was and its first line
  instead (see the `ui-design` section).
- **Taking a card off the board takes every conversation about it.**
- **Bounded**: ten conversations are kept for each card and ten for the board, the current
  one among them, and the oldest goes without asking.

## Scope out
- No search across conversations.
- No conversation shared between cards.
- No way to carry on two conversations about one card at the same time — the list is
  history, and one of them is current.
- No name of the user's own for a conversation, and no renaming or pinning one. Its short
  id, when it was and how it opened are what identify it.

## Todo
- [ ] Keep the current conversation instead of deleting it when a new one starts.
- [ ] Add "new conversation" to the rail's header, refused while a reply is coming.
- [ ] List past conversations — when, first line, message count, and the agent where it is
      not the one configured now.
- [ ] Give each conversation a short id, shown by the terminal's list and taken by its
      other options.
- [ ] Open a past conversation read-only, and carry one on as a separate action.
- [ ] Return from a past conversation to the current one without carrying it on.
- [ ] Explain a conversation whose agent session has expired: readable, not continuable.
- [ ] Leave a conversation held with another agent in the list instead of demanding it be
      cleared.
- [ ] Keep deleting one conversation at a time, from the bin and from a terminal, and
      leave an empty current conversation when the current one is the one deleted.
- [ ] Do nothing when "new conversation" is asked for on a conversation with no messages.
- [ ] Keep the Chat button's mark on the current conversation as the current conversation
      changes.
- [ ] Give a terminal `--new`, `--list` and `--open <short-id>`, let `--clear` take a
      `<short-id>`, and keep `akb chat` on the same current conversation as the rail.
- [ ] Drop every conversation about a card when that card leaves the board.
- [ ] Bound the count at ten for each card and ten for the board, oldest dropped.
- [ ] Cover it in `kanban-ui/README.md` and `cli/README.md`.
- [ ] Add the new terminal options to the command list in `docs/guides/daily-loop.md`,
      where `akb chat --clear` is the only conversation command today.

## Decided by the agent
- **How many conversations are kept?**: the newest ten for each card and ten for the board.
  Runs keep thirty, but that is one record for the whole board, while this bound applies to
  every card separately and a transcript is far larger than a run row.
- **Does the current conversation count towards the ten?**: yes. The bound is on what is
  kept for a card, so a card holds ten transcripts whether or not one of them is live.
- **What happens to a reply that lands while a past conversation is open?**: it lands in
  the current conversation as usual. Reading history is not leaving the chat, and holding a
  reply back until the reader returns would be one more thing to go wrong.
- **How does a terminal name one past conversation?**: by a short id `--list` prints. Names
  of the user's own were ruled out, and the time a conversation started is too long to type
  and too easy to mistype as a command argument. The rail's list shows no id, because on
  screen the date and the first line identify a conversation without one.
- **Does opening a past conversation make it current?**: no. Opening reads it, and a
  separate action carries it on. Browsing history should not silently move the conversation
  a terminal is holding.
- **How does the rail know a session has expired?**: it does not, and cannot — nothing
  reports whether an agent still holds a session without sending it a message. So the
  refusal comes from the message that fails rather than from a mark in the list.
- **Does a terminal keep a way to delete a conversation?**: yes. The board is meant to be
  usable over ssh with no browser, and a delete only the UI could do would strand that
  user.
- **What starts a new conversation in a terminal?**: an option of its own, separate from
  `--clear`. Overloading `--clear` to mean "keep it, and start another" would quietly
  change what an existing command does.
- **What is current after the current conversation is deleted?**: nothing — the chat is
  empty and the next message opens a fresh conversation. This is what `--clear` does today,
  and promoting the newest past conversation instead would make a delete silently reopen a
  conversation the user had already left behind.
- **Which model does a carried-on conversation run on?**: the one it was held on. #272
  keeps a conversation's model override with its transcript, so carrying a past one on
  brings its model with it, and a new conversation starts on the board's model.
- **Why does an empty conversation not go behind a new one?**: there is nothing in it to
  keep. A row with no first line and no messages identifies nothing, and it would push a
  real conversation out of the ten.
