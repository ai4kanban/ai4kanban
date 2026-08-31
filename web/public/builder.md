# Why I'm building AI4Kanban

## Tao Wu

Builder of AI4Kanban

I spent most of my career building [databases](https://github.com/risingwavelabs/risingwave), first as an engineer and later as a product manager. That combination taught me that software rarely fails because a team cannot write code. It fails when the work is unclear, context is scattered, and small decisions disappear before the next person needs them.

Coding agents made that imbalance impossible to ignore. Give Claude Code or Codex a clear requirement and it can often deliver more than I expected. Give it a vague idea and the design space opens in every direction. The agent keeps moving, but speed only gets you to the wrong place faster.

The new bottleneck is not writing code. It is turning a rough goal into good work: deciding what matters next, clarifying the edges, preserving product judgment, and knowing when a choice genuinely needs a person.

I tried managing that work in chat. The decisions were there, but buried across long conversations. Every new session felt like onboarding a capable new teammate who had never met the product. More parallel agents created more conversations to supervise, not more leverage.

That led me to what I call **kanban engineering**: use the board as the planning layer above coding agents. A broad goal becomes a set of cards. Each card is questioned and refined until it is buildable. The decisions stay attached to the project, so the next card starts with more context than the last.

- Turn rough ideas into independent, buildable cards.
- Let the agent settle ordinary details and raise the few choices that need judgment.
- Keep goals, rejected paths, and product decisions in durable project memory.
- Run ready work through the coding agent while people focus on users, direction, and taste.

AI4Kanban is my open-source attempt to make that workflow real. It is a project-management agent shaped as a kanban board, not another dashboard for watching logs. You steer requirements and approve the important calls; the board plans, remembers, and coordinates the path to delivery.

The [core is open source](https://github.com/ai4kanban/ai4kanban). I use it to manage its own development, because the only way to learn whether an autonomous board can improve a real project is to trust it with one.

## Why a kanban instead of another chat window?

Chat is good for one task. A project is a long-lived tree of goals, dependencies, decisions, and rejected paths. A board gives that structure a stable home and lets people review the work from the level that matters.

The board is primarily for the agent to plan from. People can stay with the small set of questions, reviews, and decisions that require them.

## What does “AI4Kanban” mean?

It means AI for the kanban: an agent drives each card from rough idea to clarified work, execution, and delivery. The kanban is no longer a passive list that waits for a person to update every column.

The goal is simple: spend less time supervising agents and more time deciding what creates value.
