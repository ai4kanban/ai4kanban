# When Coding Gets Faster, Project Decisions Become the Bottleneck

AI coding tools are becoming very good at turning clear requirements into working code. This changes the shape of software development. Writing code is no longer always the slowest part. The harder question is often: what should we build next?

A coding agent can implement a well-defined task quickly. But if the original idea is vague, it may make the wrong assumptions and build the wrong feature just as quickly. Faster execution does not help when the direction is unclear.

This is why the bottleneck is moving from coding to project management.

## The difficult journey from version one to a mature product

Starting a new project can feel easy. There is little history, few dependencies, and plenty of freedom. The team can make broad decisions without worrying about earlier promises or technical limits.

The challenge begins after the first version. A growing product contains hundreds of small decisions. Which user problem matters most? Which tasks depend on other work? What should be included in the next release? Which attractive ideas should be rejected?

People can easily become buried in these details. AI systems have the same problem. Giving an agent access to a large codebase does not give it a complete understanding of the product.

A codebase records what was built, but usually not why it was built. It rarely explains which alternatives were discussed, which ideas were rejected, or what the team learned from users. Those decisions may be spread across chat messages, meetings, documents, and individual memories.

Without this context, an AI agent approaches each planning task like a new team member. It may ask the same questions again, repeat old mistakes, or propose work that the team has already decided not to do.

## A board can become the project's memory

Chat is useful for one-time instructions, but a long-running project needs a more structured form of memory. A Kanban board can provide that structure.

The board should not only show task status. It should connect goals, requirements, decisions, dependencies, and progress. Each task can preserve the questions that were asked, the decisions that were made, and the reasons behind important changes.

This creates a simple planning loop:

1. A person provides a goal or a rough idea.
2. The AI reviews the idea, asks questions, and tries to answer routine questions using project memory and general knowledge.
3. When a decision requires product taste, business judgment, or a meaningful tradeoff, the AI asks a person.
4. The final decision is stored with the task and added to the project's memory.
5. The AI uses that memory when it plans or refines future work.

Over time, the system asks fewer repeated questions and becomes more consistent with the team's priorities. Rejected ideas are valuable too. Recording why an idea was rejected prevents the same weak proposal from returning again and again.

## The human role becomes more valuable, not less

The goal is not to remove people from product development. It is to use their attention where it matters most.

AI can handle much of the routine planning work: breaking down tasks, checking dependencies, refining requirements, proposing priorities, and keeping the board current. People remain responsible for direction, taste, business judgment, and final approval.

This changes the human role from writing every requirement and supervising every implementation step to reviewing value and making the decisions that truly need human judgment.

## From a passive board to an active project manager

Traditional task tools record decisions that people have already made. A planning agent can go further. It can propose useful work, turn vague ideas into clear requirements, prepare releases, and keep tasks moving through their full lifecycle.

AI4Kanban is an open-source experiment in this direction. Its cards are stored as Markdown files, so project plans and decisions remain local, readable, and versioned in Git. The board works with coding agents such as Claude Code and Codex rather than being tied to one execution tool.

The larger idea is more important than any single product: when coding becomes faster, teams need better systems for deciding what to build. A structured, persistent project memory allows AI to support that work without taking control away from people.

Software teams do not need more speed in the wrong direction. They need a clearer connection between goals, decisions, and execution. That is the problem Kanban Engineering aims to solve.
