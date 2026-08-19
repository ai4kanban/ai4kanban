# AI4Kanban — a project board that plans itself

> AI4Kanban is an agent-led project board that brings project goals, code, and
> long-term memory together to manage work from planning through completion.
> Product direction and final approval remain human decisions.

- Download the board app: https://ai4kanban.dev/download
- View on GitHub: https://github.com/ai4kanban/ai4kanban

## From task tracking to autonomous planning

Traditional boards record and track tasks, and every task has to be entered by
hand. AI4Kanban uses long-term goals and decisions already preserved in project
memory to plan work and move it forward autonomously.

| | Traditional board | AI4Kanban |
| --- | --- | --- |
| Input | Detailed tasks written by hand | Long-term goals and rough ideas |
| Primary role | Record and track tasks | Plan and drive work autonomously |
| Human role | Maintain the board by hand | Make decisions and approve the result |

## Keep work moving

Start with a goal or a rough idea. The agent reads the code and project memory,
determines what comes next, clarifies requirements, breaks down the work, orders
dependencies and priorities, and moves into execution.

- **Define the next task** — Use the goal, code, and module memory to determine
  what should happen next.
- **Clarify requirements** — Resolve what the code and project memory can answer,
  and bring forward only the product tradeoffs that require human judgment.
- **Execute** — Once the requirements are clear enough to begin, follow the scope
  and steps defined in the task.
- **Record decisions** — Write product decisions back to project memory so the
  next planning and development cycle can build on them.

## Learns as you build

Chat sessions end; product decisions remain. AI4Kanban saves the project goal and
keeps a module-by-module record of shipped features, product decisions, reasons
behind rejected ideas, and design lessons. It brings that context back when
planning and clarifying new work.

- **No need to repeat established decisions** — Preferences and constraints carry
  into planning for the next task.
- **Avoid the same dead ends** — Rejected directions and known design problems are
  not proposed again.
- **Plan from the current state** — Before planning new work, the agent reads what
  has already shipped and checks the current code.

```
docs/kanban/memory/
├─ goal.md            # the project goal
├─ local-ui/          # one folder per module
│  ├─ readme.md       # shipped features
│  ├─ decisions.md    # product decisions
│  ├─ rejected.md     # reasons for rejection
│  └─ redesign.md     # design lessons
└─ site/
```

## Drive continuous product iteration

Turn external signals into requirements that keep the product and each release
moving forward.

External inputs:

- User feedback
- Competitor research
- Industry reports
- Reddit discussions

Internal inputs:

- Product roadmap

AI4Kanban works with the board and its project data: tasks that are ready to
build, tasks that are not yet ready, and the project memory that informs both.
Other agents can work from the same data.

Iteration outcomes:

- Product improvements
- Release iterations

## Start with the board app

Download the app, open it, and select a project. No prior Node.js, npx, or terminal
setup is required. The app asks three questions that need human input, one per
screen, then reads the codebase, establishes the project goal and module memory,
and creates the first tasks.

- Autonomous planning
- Local-first
- Agent-agnostic

Current builds are unsigned. On macOS, drag the app from the `.dmg` into
Applications, then follow the prompts to allow the first launch. The download
page provides complete instructions for macOS, Windows, and Linux.

AI4Kanban requires the desktop app. It includes the `akb` CLI and automatically
adds the coding-agent skills when a project is opened. The CLI and skills are
part of the desktop workflow and are not intended for standalone installation.

Download the app: https://ai4kanban.dev/download

---

AI4Kanban · https://github.com/ai4kanban/ai4kanban
