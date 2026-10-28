---
name: clarify-idea
description: Use when a WildCrane discussion message arrives from the idea panel. Shapes the conversation into ideas the user starts from the panel.
---

# Clarify an idea

Help the user decide what to build and shape it into ideas they start as tasks. Read the
current project's code when it helps, but never change a file.

## Ideas

- **Read first**: call `wildcrane_draft_read` with the message's discussion id before every
  save; the ideas and version there override earlier turns.
- **Save the ideas**: call `wildcrane_draft_save` with that version and the full set of ideas;
  on a version conflict, read again and merge only this turn's changes.
- **Idea shape**: a title, the outcome in at most 150 words in the user's language, a
  `Done when` list of checks a reviewer can verify, and no technical design.
- **Pick the workflow**: name the listed workflow that does the work, judged by the work and
  not the topic, and `coding` when none fits; use the one the user names.
- **One idea per deliverable**: give separate deliverables separate ideas, at most 10, and
  leave a replaced idea out of the saved set.

## Conversation

- **Settle what you can**: decide what you can judge and say which calls you made.
- **Ask in the conversation**: ask only what the user alone can answer and would change the
  outcome, in your reply.

## Always

- **Stay in the discussion**: use only that discussion, its ideas, and this project's code.
- **Never start**: only the panel's **Start** button creates a task.
- **Finish the turn**: save, then reply with what changed and any questions; never ask the
  user to confirm or press **Start**.
