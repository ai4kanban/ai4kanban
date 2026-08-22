---
title: Keep past conversations instead of only throwing them away
track: features
priority: low
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions:
  - question: "[user] Does a card get more than one conversation at a time, or one live conversation with the old ones behind it?"
    mode: single
    options:
      - One live conversation, with the old ones behind it in a list.
      - Several at once, picked from a tab strip.
    recommend: [1]
---

A conversation can only be thrown away. So the user keeps a stale one rather than lose what
was said in it, and a chat about a card carries weeks of unrelated context into every new
question.

## Today
- One transcript per card and one for the board (`cli/src/lib/agent/chat.ts`).
- The bin in the rail's header clears it, and it is gone — the file and the session id with
  it.
- A coding agent's own chat lists past sessions and picks one back up.

## Scope
- **Start fresh without losing the last one**: a "new conversation" that puts the current
  one behind it rather than deleting it.
- **A list of what came before**, in the rail's header: when it was, its first line, and
  how many messages.
- **Open an old one and read it.** Carrying it on is a bonus, not the point — the session
  id may have expired on the agent's side, and the rail says so plainly rather than
  failing.
- **The bin still deletes**, one conversation at a time, with the confirmation it has now.
- **Same in a terminal**: `akb chat` reads and writes the same conversation, so whatever
  the rail shows as current is what a terminal continues.
- Where the transcripts live and how many are kept follows what the board does with runs —
  a bounded number, oldest dropped.

## Scope out
- No search across conversations.
- No conversation shared between cards.

## Todo
- [ ] Keep a cleared conversation instead of deleting it, under the same key.
- [ ] Add "new conversation" to the rail's header.
- [ ] List past conversations, with when, first line, and message count.
- [ ] Open an old one read-only; carry it on where the agent's session is still good, and
      say so plainly when it is not.
- [ ] Keep `akb chat` and the rail on the same current conversation.
- [ ] Bound how many are kept, oldest dropped.
- [ ] Cover it in `kanban-ui/README.md` and `cli/README.md`.
