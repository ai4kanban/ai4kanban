---
title: Run the board on the coding agent you already pay for
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [shipped, landscape]
questions:
  - question: "[user] Which angle and hook does this lead with?"
    mode: single
    options:
      - "The agent you already pay for — open on the eight agents by name and how little it takes to switch. Cost: reads as a feature list unless the switch is actually shown."
      - "Betting on one agent is the risk — open on how much the agent landscape moved this year. Cost: an argument piece, slower to the point, and it invites a vendor fight."
      - "I ran the same card on four agents — open on the side-by-side. Cost: cannot be written until those runs exist and are screenshotted."
    recommend: [1]
  - question: "[user] Which channels, and which of them leads?"
    mode: single
    options:
      - "X leads, LinkedIn follows — agent switching is argued in English. Cost: no 小红书 reach on our largest audience."
      - "小红书 leads, X follows — our biggest following. Cost: half the agent list (Grok Build, ZCode, Kimi) lands differently there."
      - "Reddit r/ClaudeAI leads, X follows — where the comparison actually gets had. Cost: promo reads as spam unless it opens as a real question."
    recommend: [1]
---

A piece for developers who already run a coding agent daily and assume a planning tool means
picking one and living with it: AI4Kanban drives eight of them — Claude Code, Codex, Cursor,
OpenCode, Kimi Code, DeepSeek Harness, ZCode and Grok Build — and switching is one setting.

## Worth noting
- **Written for people already using an agent**: `decisions.md` settles the audience for
  every piece, so this one never stops to explain agentic coding first; the cost is that a
  reader who has not tried Claude Code or Codex will bounce.

<!-- agent -->

## Today
- **Nothing published names more than one agent**: the one line in `memory/published.md` is
  about Kanban Engineering as an idea. The unimported posts in `social-posts/` say "Claude
  Code 或 Codex" in passing and never make the list itself the point.
- **What actually shipped**: eight connectors, each with its own install and sign-in, and a
  run picks one per board (`docs/kanban/memory/skill/readme.md`,
  `web/content/docs/connectors.mdx`).

## Scope
- **The claim is the list, by name**: Claude Code, Codex, Cursor, OpenCode, Kimi Code,
  DeepSeek Harness, ZCode, Grok Build. Nothing else — Antigravity has not shipped.
- **Show the switch, do not describe it**: one setting, one line, or one screenshot of the
  runtimes grid. Without it the piece is a feature list.
- **Say what does not change when you switch**: the board, the cards and the memory are
  Markdown in your repo, so the agent is the replaceable part.
- **Must not claim**: that every agent performs the same, or that any of them is bad. Say
  what each is for where a difference matters.
- **Lead channel**: whichever the channels question settles; every other chosen channel is a
  repurposing of `source.md`, not a second draft.

## Todo
- [ ] settle the two `[user]` questions
- [ ] write `content/3-run-on-any-agent/source.md` for the lead channel
- [ ] commit the draft before it is edited — the writing rules are read from that diff
- [ ] user edits the draft, then publishes it by hand
- [ ] append the `published.md` line: date, channel, URL, result
- [ ] diff the draft against what was posted and add the writing rules

## Decided by the agent
- **The audience is settled, not asked**: `decisions.md` already names it, so only the angle,
  the hook and the channels are left to taste.
- **Not a benchmark**: comparing the agents on output quality needs runs we have not made,
  and it turns a positioning piece into a fight. The piece says they all work.

### Overruled by the user

## Source
`docs/kanban/memory/skill/readme.md` and `README.md`, via the planning sources in
`marketing/kanban/config.md`.
