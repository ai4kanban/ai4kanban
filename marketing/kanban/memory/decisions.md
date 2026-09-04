# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Positioning

- **Who we write for**: people who already run a coding agent every day — Claude Code,
  Codex, Cursor — and have felt the bottleneck move off writing code and onto deciding what
  to build. Solo builders and small teams, not enterprise buyers.
- **Who we do not write for**: anyone who does not use a coding agent yet. A piece that has
  to sell agentic coding first is the wrong piece.
- **The one sentence**: coding got fast, product decisions became the bottleneck, and
  AI4Kanban is the layer that settles what to build before anything runs.
- **Why a board and not a chat window**: a chat is one short task at a time and its memory
  is bottom-up and messy; a board is built for long-horizon work, hides execution detail,
  and keeps memory as a top-down tree. This is the argument, not a feature list.
- **The proof is that we use it**: AI4Kanban is planned and built on AI4Kanban. Any piece
  may say so, and a piece that shows the board's own numbers is stronger than one that
  describes a capability.

## What we may claim

- **Open source and free**: Apache 2.0 — free to use, modify and redistribute.
- **Local-first**: the board is Markdown under `docs/kanban/`, versioned in Git. No
  database, no account, no MCP server, and nothing about a Local board leaves the machine.
- **Agent-agnostic, by name**: Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek
  Harness, ZCode and Grok Build. Name only agents that already ship.
- **Cloud is an invite-only preview**: the agent still runs on your machine, over your
  repository; Cloud receives no code and runs no agent. We have published no price, so no
  piece names one or implies a paid tier.
- **Numbers carry their source**: 112 completed, 218 created and 29 rejected is our own
  board's first month, and it is already published as that — throughput, not a speedup.
  "3x" is our own before-and-after of leaving the chat window, with no window recorded, so
  a piece using it says that in the same breath. "6x task completion" was one user's
  project. A number without whose project and over what window is not a claim we make.
- **Never claim the roadmap**: check `docs/kanban/memory/*/readme.md` before writing that
  something works. If it is not there, it has not shipped.
- **Competitors by purpose, never by insult**: say what grill-me, spec-driven frameworks or
  another agentic board are *for*, and where ours differs. No piece calls another tool bad.

## kanban-engineering

- **The word is ours and we say so**: "Kanban Engineering" was coined here. Pieces admit
  that openly rather than presenting it as an established term.

## shipped

- **A release is told as what you can now do**, not as a version number and a changelog.
  The version is context at the end, not the headline.

## building-in-public

- **The board's own metrics are fair game**: completed, created and rejected counts, and
  screenshots of the real board. What is on screen is what shipped.

## landscape

- **grill-me is the closest comparison**: same clarify-by-questioning idea, no cross-session
  memory and no project management around it. That is the difference every landscape piece
  draws.
