# AI4Kanban — a project board that plans itself

> It brings your goals, code, and project memory together to manage work from
> planning through completion. You make the product calls and give final
> approval.

- Download the board app: https://ai4kanban.dev/download
- View on GitHub: https://github.com/ai4kanban/ai4kanban

## From task tracking to autonomous planning

Traditional boards only record and track tasks, and every input has to be
written by hand. AI4Kanban uses your long-term goals and the decisions already
in project memory to plan work and move it forward autonomously.

| | Traditional board | AI4Kanban |
| --- | --- | --- |
| Input | Detailed tasks written by hand | Long-term goals and rough ideas |
| Primary role | Record and track tasks | Plan and drive work autonomously |
| Your role | Maintain the board by hand | Make decisions and approve the result |

## Keep work moving

Give it a goal or a rough idea. The agent reads your code and project memory,
determines what comes next, clarifies requirements, breaks the work down, orders
dependencies and priorities, and moves into execution.

- **Define the next task** — Use the goal, code, and module memory to determine
  what should happen next.
- **Clarify requirements** — The agent resolves anything it can from the code and
  project memory, bringing you only the product tradeoffs that require your
  judgment.
- **Execute** — Once the requirements are clear enough to begin, the agent
  follows the scope and steps defined in the task.
- **Record decisions** — Write product decisions back to project memory so the
  next planning and development cycle can build on them.

## Learns as you build

Conversations end. Product decisions stay. AI4Kanban saves your project goals and
keeps a module-by-module record of shipped features, product decisions, reasons
behind rejected ideas, and design lessons. It brings that context back when
planning and clarifying new work.

- **No need to repeat yourself** — Established preferences and constraints carry
  straight into planning the next task.
- **Avoid the same dead ends** — Rejected directions and known design problems
  are not proposed again.
- **Pick up where you left off** — Before planning new work, it reads what has
  already shipped and checks the current code.

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

Turn external signals into requirements that keep the product — and each
release — moving forward.

External inputs:

- User feedback
- Competitor research
- Industry reports
- Reddit discussions

Internal inputs:

- Product roadmap

The project data it reads and writes:

- The board itself — the cards that are ready to build, and the ones that are
  not yet.
- Project memory — the goal, shipped features, product decisions, rejected
  ideas, and design lessons.
- All of it plain Markdown in your repo, so any agent can run the work.

Iteration outcomes:

- Product improvements
- Release iterations

## Start with the board app

Download the board as a desktop app at https://ai4kanban.dev/download — nothing
to install first: no Node, no npx, no terminal. No build is signed yet, so macOS
blocks the first open: drag the app in from the `.dmg`, then click through the
warning that it cannot be checked. The download page has every step, and Windows
and Linux.

Open it, point it at a project folder, and it asks the three things only you can
answer — one to a screen, everything prefilled: what the project is and the
tracks its work falls into, your project goal, and which agent runs the board.
Then it reads your codebase, settles the first decisions, maps the modules, and
creates your first ten tasks.

Or set it up from a terminal. One command, from your project root:

```
npx ai4kanban@latest install
```

That creates the board under `docs/kanban/` and writes nothing else. Rather your
coding agent did the whole thing? Give it the setup prompt at
https://ai4kanban.dev/INSTALL_PROMPT.txt — it reads the repo, picks the tracks,
runs that command, and works down the rest of setup. Updating later is one
command too: `npx ai4kanban@latest update`.

Driving the board from a coding agent is a separate, optional step — installing a
board does not install the skill. Add it with `npx ai4kanban@latest skill install`,
or from the app's **Configuration → Skill** button.

---

Install ai4kanban · https://github.com/ai4kanban/ai4kanban
