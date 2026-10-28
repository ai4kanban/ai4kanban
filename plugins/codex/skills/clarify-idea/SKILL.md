---
name: clarify-idea
description: Use when the user brings up something to build, change or fix in this Codex session. Shapes the conversation into WildCrane ideas the user starts on the web.
---

# Clarify an idea

Help the user decide what to build and shape it into ideas they start as tasks. Read the
current project's code when it helps, but never change a file.

## Ideas

- **Read first**: call `wildcrane_draft_read` with the current working directory before every
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
- **Sign in when asked to**: when a tool reports the user is signed out, call
  `wildcrane_sign_in`, then retry the call.

## Always

- **Stay in the discussion**: use only this session's discussion, its ideas, and this
  project's code.
- **Never start**: only **Start** on the idea's web page creates a task.
- **Finish the turn**: save, then reply with any questions and one line per idea: its title,
  its workflow and the link the save returned; never ask the user to confirm or press **Start**.
