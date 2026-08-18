// English copy for the Task Master comparison — the source of truth the other
// four languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const en: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Task Master — write the spec, or be asked for it",
    socialTitle: "AI4Kanban vs. Task Master",
    description:
      "Compare AI4Kanban and Task Master (Taskmaster). Task Master splits a PRD you already wrote into an ordered backlog. AI4Kanban starts from a rough idea and asks until the card is buildable.",
    social:
      "Task Master needs a PRD before it can help. AI4Kanban starts from one rough line and asks you the rest. See which starting point matches how you actually work.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nTask Master",
    lead: "Both give a coding agent a task list instead of a chat window. Task Master takes the requirements document you wrote and splits it into an ordered backlog. AI4Kanban starts one step earlier: you give it a rough line, and it asks questions until there is something worth building.",
    ours: {
      name: "AI4Kanban",
      body: "A Markdown board in your repo. The agent proposes work, asks what it can't settle, and archives what ships.",
    },
    theirs: {
      name: "Task Master",
      body: "A task engine for any AI editor. Parse a PRD, expand it into subtasks, and work the backlog down.",
    },
    oursDiagramAlt:
      "One rough line goes into AI4Kanban. It asks the questions it can't answer itself and hands back a finished card.",
    theirsDiagramAlt:
      "A finished requirements document goes into Task Master and comes back split into numbered tasks in dependency order.",
    oursDiagramTop: "one rough line in",
    oursDiagramBottom: "it asks, then writes the card",
    theirsDiagramTop: "the document you wrote in",
    theirsDiagramBottom: "numbered tasks, in dependency order",
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "The difference is what you have to bring.",
    },
    lead: "Task Master — written `Taskmaster` in its own docs — is the best-known task manager for coding agents, and it is good at its job. It reads a product requirements document, splits it into tasks with dependencies, scores how complex each one is, expands the heavy ones into subtasks, and hands you the next unblocked task. If you already write specs, that is most of what you need.",
    panel:
      "AI4Kanban assumes you don't have the spec yet. You give it one line. It reads the code and the project's memory, settles what it can on its own, asks you only what is genuinely open, and repeats until the card is concrete enough to build. **The questions are the product.** The board is where the answers stay.",
    note: "Checked on 10 August 2026: the latest Task Master release is 0.43.1 (31 March 2026) and the newest commit on `main` is 23 April 2026, while the same team builds Hamster, a hosted planning workspace. The package is still installed about 78,000 times a month, so this is a widely used tool with a quiet repository — not an abandoned one.",
  },
  start: {
    heading: {
      eyebrow: "Day one",
      title: "What you have to bring before either one helps",
    },
    lead: "Same goal — a task a coding agent can finish without guessing. The two tools ask for different things at the start, and that is nearly the whole comparison.",
    ours: {
      label: "AI4Kanban",
      title: "One line is enough",
      steps: [
        "Say the rough idea. No format, no document, no template.",
        "The agent reads the code and the project's past decisions, settles what it can, and asks you only the questions that are still open.",
        "It writes the card, places it against the rest of the board by value and dependency, and keeps your answers for next time.",
      ],
    },
    theirs: {
      label: "Task Master",
      title: "A written document first",
      steps: [
        "Write the requirements document. Their guide suggests co-writing it with a chat model, then saving it as `.taskmaster/docs/prd.txt`.",
        "`parse-prd` splits it into tasks with dependencies, `expand` breaks them into subtasks, and `analyze-complexity` scores which ones need more breaking down.",
        "`next` hands you the highest-priority task nothing is blocking.",
      ],
    },
    note: "Neither route is hard. But when the document is vague, Task Master splits a vague document — you can always run `update-task` with more context, and the research model can go read up on something, but nothing in the loop asks you what you actually meant.",
  },
  comparison: {
    heading: { eyebrow: "Head to head", title: "AI4Kanban vs. Task Master" },
    lead: "A {check} marks the clearer fit for that need; a **dash** means it depends on how you work. Task Master is stronger on **reach, batch execution, and live research**. AI4Kanban is stronger on **getting from a rough idea to a real spec, and keeping what was decided**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Task Master",
    rows: {
      startingPoint: {
        dimension: "Where a task comes from",
        kanban:
          "A rough line from you, or a proposal the agent makes on its own after reading the code and the board.",
        taskMaster:
          "A requirements document you write first, parsed into tasks. You can also add one task at a time from a prompt.",
      },
      vagueRequest: {
        dimension: "When the request is vague",
        kanban:
          "A refine loop answers what memory and the code can answer, asks you the rest, and won't call the card ready while a question is open.",
        taskMaster:
          "Tasks come out as specific as the document went in. You can update a task, expand it, or send the research model to look something up.",
      },
      board: {
        dimension: "What the board is on disk",
        kanban:
          "One Markdown file per card under `docs/kanban/`, plus plain-text memory files. A diff reads like a sentence.",
        taskMaster:
          "One `.taskmaster/tasks/tasks.json` holding every task and subtask; `generate` can also write a text file per task.",
      },
      setup: {
        dimension: "What you set up",
        kanban:
          "One prompt. No MCP server, no API keys, no model configuration — your coding agent's own model does the thinking.",
        taskMaster:
          "An MCP server or the CLI, plus main, research, and fallback models. The Claude Code and Codex providers need no extra key; most of the other providers do.",
      },
      execution: {
        dimension: "Running the work",
        kanban:
          "Your agent implements the card and archives it. There is no batch runner and no enforced test workflow.",
        taskMaster:
          "`loop` runs Claude Code in fresh sessions back to back, with presets for tests, linting, and duplication; `autopilot` drives a red-green-commit TDD cycle on its own branch.",
      },
      memory: {
        dimension: "What carries over",
        kanban:
          "Per-module memory: decisions, rejected ideas, design corrections, and shipped work — read before the next proposal, so a no stays a no.",
        taskMaster:
          "Timestamped notes appended to subtasks, saved research files, and tags that keep separate task lists apart.",
      },
      reach: {
        dimension: "Where it runs",
        kanban:
          "Claude Code, Codex, Cursor, and OpenCode today. The board is plain files, so another harness needs no new format — only wiring.",
        taskMaster:
          "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro, Amazon Q and more, over MCP or the CLI, with more than fifteen model providers.",
      },
      teams: {
        dimension: "More than one person",
        kanban:
          "Git is the collaboration: branch, review the plan in a pull request, merge. Nothing syncs in real time.",
        taskMaster:
          "The open-source board is local too, but the same team sells Hamster, a hosted workspace with shared briefs and sync, from $40 per creator per month.",
      },
      license: {
        dimension: "Licence",
        kanban:
          "Apache-2.0. Use it, fork it, sell something built with it — no extra conditions.",
        taskMaster:
          "MIT with the Commons Clause: free for personal, commercial, and academic use, but you may not sell Task Master itself or offer it as a hosted service.",
      },
    },
  },
  boardShape: {
    heading: {
      eyebrow: "On disk",
      title: "One JSON file, or one file per card",
    },
    lead: "Both boards sit in your repository, so both are versioned with the code. What differs is what a diff shows a human.",
    oursLabel: "AI4Kanban",
    theirsLabel: "Task Master",
    oursCaption:
      "One card, one Markdown file. A pull request shows the plan changing in words you can read and argue with.",
    theirsCaption:
      "One file holds the whole backlog. A diff shows JSON — accurate, and not written to be read.",
    note: "Task Master added cross-process file locking in 0.42.0 so two processes writing the board at once can't lose data. Separate files don't share that contention: two runs collide only when they edit the same card.",
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
    lead: "Task Master reaches further, runs longer without you, and can go look things up. AI4Kanban is narrower on purpose: it earns its place in the part of the job that happens before there is a task at all.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Task Master",
    ours: {
      asksFirst: {
        title: "It asks before it builds",
        body: "The agent turns a rough line into questions, answers what it can from the code and past decisions, and hands you only what nobody else can settle.",
      },
      diffablePlan: {
        title: "The plan is readable prose",
        body: "Every card is a Markdown file. You review a plan the way you review code — in a diff, in words, before anything is written.",
      },
      moduleMemory: {
        title: "It remembers what you turned down",
        body: "Decisions, rejected ideas, and design corrections are kept per module and read before the next proposal, so the board stops suggesting the same thing twice.",
      },
      nothingToWire: {
        title: "Nothing to stand up",
        body: "No MCP server, no API keys, no model roles to configure, no tool schemas in every conversation. One prompt installs it into a repository.",
      },
    },
    theirs: {
      everywhere: {
        title: "It runs almost anywhere",
        body: "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro and more, over MCP or a CLI, against more than fifteen model providers including local ones.",
      },
      research: {
        title: "A research model is built in",
        body: "A dedicated research role can pull in current information while tasks are written or expanded, and saves what it found beside the tasks.",
      },
      batchRuns: {
        title: "It can work while you sleep",
        body: "`loop` spawns a fresh agent session per task with presets for tests, linting, duplication, and code smells; `autopilot` runs a strict TDD cycle on its own branch.",
      },
      proven: {
        title: "It is the one people already know",
        body: "Around 28,000 GitHub stars and roughly 78,000 npm installs a month, with docs, a Discord, and years of shared workflows to copy.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "The decision", title: "Which one fits your workflow?" },
    oursHeading: "Choose AI4Kanban when",
    theirsHeading: "Choose Task Master when",
    ours: [
      "Your ideas start as a sentence, and writing the spec is the part that stalls.",
      "You want the plan and the reasoning behind it reviewable in a diff, next to the code.",
      "You want the board to remember decisions and rejections and stop re-asking.",
      "You'd rather not run another MCP server, hold more API keys, or configure models.",
    ],
    theirs: [
      "You already write requirement documents, and you want them split and ordered well.",
      "You work in Cursor, Windsurf, VS Code, or Kiro and want the board in the editor.",
      "You want batch autonomous runs or a strict test-first workflow out of the box.",
      "You want live research folded into planning, or a specific model provider we don't cover.",
    ],
    verdict:
      "Task Master starts where your spec ends. AI4Kanban starts before it — its whole job is the stretch between a rough idea and a task worth handing to an agent. If you write good documents, Task Master will get more done today. If the documents are what never get written, that gap is the thing to fix first.",
    note: "They are not exclusive: a PRD written against a refined AI4Kanban card parses perfectly well. But one board has to own task status, or you will keep two.",
  },
};

export default en;
