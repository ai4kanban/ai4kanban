# Kanban for Codex: planning before parallel execution

> How AI4Kanban clarifies requirements, preserves product decisions across Codex tasks, and
> tells you when a run genuinely needs human attention.

## The short answer

Codex executes tasks. AI4Kanban is the planning layer above those tasks: it clarifies what
should be built, keeps product decisions consistent across sessions, coordinates dependencies,
and asks for human judgment only when project evidence cannot supply the answer.

Codex already gives you parallel tasks, reusable project instructions, skills, MCP servers, and
resumable threads. A kanban should not duplicate those features. Its useful job begins earlier:
deciding whether a task is ready for Codex and preserving the product context that should
constrain every task after it.

## Why use a kanban when Codex already supports parallel tasks?

Parallel execution answers **how many tasks can run at once**. It does not decide whether those
tasks are the right work, whether they depend on one another, or whether ten sessions are making
ten incompatible product assumptions.

| Layer | What it owns |
| --- | --- |
| You | Product direction, taste, business judgment, major risk, and acceptance |
| AI4Kanban | Requirement clarification, task boundaries, dependencies, project memory, and delivery state |
| Codex | Implementation, tests, review fixes, and the technical work inside an approved card |

## Can Codex clarify requirements before coding?

AI4Kanban runs a clarification loop before implementation. It does not send every uncertainty
to you.

1. It inspects the card, current code, relevant documentation, and project memory.
2. It resolves technical facts and reversible choices from that evidence.
3. It challenges the proposed scope, acceptance criteria, dependencies, and edge cases.
4. It leaves open only the decisions that materially affect the product and require human judgment.

An open question arrives with a concise explanation, distinct options, and a recommendation.
After you answer, the board merges the choice into the card instead of leaving it buried in a
transcript.

## How does project memory keep Codex aligned?

Codex can resume one thread, but a project lasts across many threads, context compactions,
models, and tasks. AI4Kanban stores durable product context as Markdown:

```text
docs/kanban/
├── memory/
│   ├── readme.md      — shipped behavior
│   ├── decisions.md   — settled product calls
│   ├── rejected.md    — paths not to repeat
│   └── redesign.md    — corrections and design lessons
└── todo/              — current cards
```

The codebase tells Codex what exists. These files add why it exists, which alternative was
rejected, what a previous review corrected, and what future planning should treat as a default.
Each run reads only the memory relevant to its card.

## How will I know when Codex genuinely needs me?

| Signal | What it means | What you do |
| --- | --- | --- |
| Product question | Project evidence cannot settle a consequential choice | Choose an option or provide the missing judgment |
| Codex sandbox refusal | The run attempted an operation outside its current permission boundary | Revise the task or deliberately widen the Codex command |
| Implementation blocker | The run recorded the failed step, cause, and unblock action | Resolve that condition, then resume |
| Delivery review | The code is ready for acceptance or a manual check | Approve the diff or verify the result |

Questions and approval requests appear in the app's notification center and can be sent to
Slack. An optional diff-approval setting holds the exact reviewed tree before it lands.

## How does AI4Kanban fit an existing Codex setup?

AI4Kanban runs your installed official Codex CLI locally. Codex continues to use:

- your ChatGPT subscription login, OpenAI API key, or Responses-API gateway;
- your selected model and reasoning effort;
- the project's `AGENTS.md` instructions;
- installed Codex skills and configured MCP servers; and
- the same Codex thread when a failed or stopped run resumes.

AI4Kanban adds the requirement lifecycle, project memory, dependencies, worktrees, run status,
token reporting, estimated cost, and delivery controls around that existing setup.

## Can AI4Kanban run Codex safely without hiding what it is doing?

Automatic deliveries build on separate branches in separate Git worktrees under
`.akb/worktrees/`. Codex tasks do not write over one another or mix with edits in your main
checkout. You can switch to manual mode and commit after review passes.

Board runs use Codex's workspace-write sandbox. Network access is enabled for installs and Git
fetches, but writes remain fenced to the project unless you explicitly customize the command.

The board streams the live log and records status, duration, model, token counts, and estimated
cost when the model rate is known. You can stop a run, keep its worktree, and resume the same
Codex thread. AI4Kanban never pushes.

## Frequently asked questions

### Does it work with a ChatGPT subscription, or do I need an API key?

Both work. AI4Kanban can use the ChatGPT login already held by your local Codex CLI, an OpenAI
API key, or a Responses-API gateway.

### Can I choose the Codex model and reasoning effort for each kind of work?

Yes. Named runtimes can assign different Codex models and effort levels to refine, implement,
review, or specialist-agent flows.

### Can I set a token or cost limit before starting a Codex run?

Not as a board-level hard cap today. AI4Kanban records tokens and estimates cost when it knows
the model rate, but it does not stop a run at a number you enter.

### Can AI4Kanban run several Codex tasks at once?

Yes. Independent cards build concurrently in isolated worktrees. Landing is serialized.

### Can Codex work in my main checkout instead of a new worktree?

Yes. Disable automatic commits globally or the branch option for one delivery. One delivery then
runs in your checkout, and you commit after review.

### How are `.env` files and dependencies handled inside worktrees?

A fresh worktree contains tracked files, not ignored local files or installed dependencies. Add
an implement rule for dependency installation and local configuration. Agent API keys live in
`docs/kanban/.env`, kept out of Git.

### Will Codex ever commit, merge, or push without my approval?

Automatic mode can create focused commits and land one squash commit. Enable diff approval or
use manual mode if every tree must wait for you. AI4Kanban never pushes.

### What happens when Codex fails or reaches its usage limit?

The delivery and worktree remain. Stop the run or let the silence timeout end it, then Resume
continues the saved Codex conversation.

### Can I resume the same Codex session after restarting a task?

Yes. Resume uses the saved Codex thread ID and records the continuation as a fresh board run.

## Where to go next

- [Download AI4Kanban](https://ai4kanban.dev/download)
- [Read the daily loop](https://ai4kanban.dev/docs/daily-loop)
- [Check Codex connector details](https://ai4kanban.dev/docs/connectors)
- [View the source on GitHub](https://github.com/ai4kanban/ai4kanban)
