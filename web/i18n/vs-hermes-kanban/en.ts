// English copy for the Hermes Agent Kanban comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const en: VsHermesCopy = {
  meta: {
    title: "AI4Kanban vs. Hermes Agent Kanban: review the key parts before agents build",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description: "Already using Claude Code or Codex, and want to see the UI, prompt or copy before agents build it? AI4Kanban fits. Already running Hermes Agent, and want to manage tasks from Telegram or Slack? Hermes Kanban fits. See where each is stronger, row by row.",
    social: "Hermes Kanban puts your Hermes agents to work and lets you steer them from chat apps. AI4Kanban puts Claude Code or Codex to work and shows you drafts of the key parts first. Which fits how you work?",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Built-in specialist workflows and draft approval put your judgment before the build, so you correct less afterwards.",
    sharedLabel: "Both support",
    setup: {
      heading: "Specialist agents and workflows, ready to use",
      ours: "Built-in agents and workflows cover software development, blogs, social carousels, slide decks and product videos. You can also create your own.",
      theirs: "Workers are Hermes profiles you set up with a model and skills. No built-in specialist workflows for UI design, copywriting or content production.",
      art: {
        ours: [
          "UI design",
          "Prompts",
          "Copy",
        ],
        theirs: {
          title: "Worker profile",
          fields: [
            "Name",
            "Model",
            "Skills",
          ],
          slot: "Yours to set up",
        },
      },
      shared: [
        {
          title: "Task breakdown and dependencies",
          body: [
            "AI4Kanban splits work into cards and subtasks, with dependencies controlling execution order.",
            "Hermes Kanban breaks a one-line task into child tasks and runs a child once its parents are done.",
          ],
        },
        {
          title: "Parallel runs in git worktrees",
          body: [
            "AI4Kanban runs independent cards side by side, each in its own git worktree.",
            "Hermes Kanban runs tasks in parallel, with a git worktree per task.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Review key drafts before implementation",
      ours: "Choose the UI, prompts, copy or other key parts you want to review. Agents prepare drafts you can preview and edit, then build from what you approve.",
      theirs: "Tasks start from a text spec. Its docs describe no preview and approval of key drafts before execution.",
      art: {
        ours: [
          "Key draft",
          "Approve direction",
          "Run the task",
        ],
        theirs: {
          title: "Task spec",
          fields: [
            "Goal",
            "Approach",
            "Acceptance criteria",
          ],
          slot: "Text only",
        },
      },
      shared: [
        {
          title: "A written spec",
          body: [
            "AI4Kanban cards hold the scope and build steps.",
            "Hermes Kanban can rewrite a task into a goal, approach and acceptance criteria.",
          ],
        },
        {
          title: "Feedback on the task",
          body: [
            "AI4Kanban takes your changes in the card chat and updates the plan.",
            "Hermes Kanban takes your notes to the worker in task comments.",
          ],
        },
      ],
    },
    questions: {
      heading: "Settle the requirements first, then stop watching",
      verdict: "Watching less doesn’t mean lower quality: drafts, questions and key-point summaries keep the result on track.",
      ours: "It doesn’t start blind. It first asks the questions that matter and pins down what the delivery must meet, then builds. You approve the key points and leave the details to agents, so you don’t have to watch every run, and you can ship more work in a day.",
      theirs: "Light planning, fast execution: work starts as soon as it is broken down, the bar is adjusted along the way, and fixes are made in the worktree. That is a valid way to work, but it relies on you checking in as it runs, which limits how much work you can ship in a day.",
      art: {
        ours: [
          "Clarify",
          "Approve key points",
          "Run",
        ],
        theirs: {
          title: "Running task",
          fields: [
            "Start",
            "Adjust the bar",
            "Fix in worktree",
          ],
          slot: "Check in as it runs",
        },
      },
      shared: [
        {
          title: "Agents that learn as they work",
          body: [
            "AI4Kanban’s specialist agents note the drafts you send back or overrule, and finished cards are reviewed for decisions and preferences.",
            "Each Hermes profile keeps memory notes and writes its own skills from what it learns, including your corrections.",
          ],
        },
        {
          title: "Task history",
          body: [
            "AI4Kanban keeps plans, conversations and run records on the card.",
            "Hermes Kanban keeps a comment thread and run history on the task.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "Key differences",
      title: "Compare the details",
    },
    lead: "A {check} marks the stronger side on each row.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      startingPoint: {
        dimension: "Built-in agents and workflows",
        kanban: "Built-in specialist agents and workflows for development and content. Create your own. Content workflows require Pro.",
        hermes: "General-purpose Hermes profiles you set up. No built-in specialist workflows for UI design, copywriting or content production.",
      },
      planning: {
        dimension: "Before work starts",
        kanban: "Planning settles what it can and asks you what is still open. Nothing is built until you start it.",
        hermes: "A model breaks the task into a task graph without asking you; child tasks start on their own unless you turn that off.",
      },
      drafts: {
        dimension: "Key draft review before execution",
        kanban: "Image, diagram, HTML/TSX, diff and storyboard drafts. Approved content becomes part of the execution requirements.",
        hermes: "A text spec with goal, approach and acceptance criteria. No draft preview before execution in its docs.",
      },
      questions: {
        dimension: "Questions for you",
        kanban: "Asked while planning or mid-build, each with options and a recommended answer; only dependent work waits, and it continues once you answer.",
        hermes: "A worker pauses the whole task with a written reason; you comment, unblock it, and the worker starts again.",
      },
      memory: {
        dimension: "What agents remember",
        kanban: "Each specialist agent notes the drafts you send back or overrule; finished cards are reviewed for decisions and preferences.",
        hermes: "Each profile keeps memory notes and writes its own skills from what it learns, including your corrections.",
      },
      followUps: {
        dimension: "Work after delivery",
        kanban: "Agents review what shipped and suggest follow-up work with reasons; a QA agent tests recent changes daily. Suggestions wait in triage for your decision.",
        hermes: "Workers create child tasks to split up work in progress. Follow-up after delivery is a new task you create.",
      },
      landing: {
        dimension: "Merging parallel work",
        kanban: "Each finished build is rebased and merged in turn; an agent resolves conflicts.",
        hermes: "Worktrees are kept after the task. Merging back is not documented; conflicts go to a separate reconciliation task.",
      },
      recurring: {
        dimension: "Recurring work",
        kanban: "Scheduled agents run on a cadence you set.",
        hermes: "One-off scheduled starts. Recurring work needs your own cron job.",
      },
      harness: {
        dimension: "Running Claude Code or Codex",
        kanban: "Claude Code, Codex, Cursor, OpenCode and other coding agents run the work directly, on your own subscriptions; choose one per agent.",
        hermes: "Workers are Hermes agents; a bundled skill lets one call Claude Code or Codex from the terminal.",
      },
      interface: {
        dimension: "Board and interface",
        kanban: "A desktop app for cards, drafts, conversations and run status.",
        hermes: "A CLI, a web dashboard and a Desktop app plugin.",
      },
      review: {
        dimension: "Checking the work",
        kanban: "Claude Code or Codex run tests and check the requirements as they build; AI4Kanban adds no second review pass, to avoid over-testing.",
        hermes: "A reviewer profile checks each acceptance criterion and runs tests, sending work back until it passes.",
      },
      chat: {
        dimension: "Control from chat apps",
        kanban: "Notifications, Slack and Lark need Cloud, which is in invite-only preview.",
        hermes: "Manage the board with /kanban from Telegram, Discord, Slack, WhatsApp, Signal and more, with task notifications.",
      },
      recovery: {
        dimension: "Recovery from failed runs",
        kanban: "Provider errors are retried automatically. A stopped run waits for you to resume it.",
        hermes: "Heartbeats reclaim stalled tasks, and a task that keeps failing is put on hold.",
      },
      api: {
        dimension: "API and extensions",
        kanban: "A CLI that coding agents call. No public API.",
        hermes: "A REST and WebSocket API, plus plugin hooks for task events.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recommendation",
      title: "Which should you choose?",
    },
    oursHeading: "Choose AI4Kanban if you",
    theirsHeading: "Choose Hermes Kanban if you",
    ours: [
      "Want built-in specialist agents and workflows, or to create your own.",
      "Want to approve key UI, prompt or copy drafts before full execution.",
      "Want agents to suggest follow-up work after each delivery.",
    ],
    theirs: [
      "Already run Hermes Agent and want the board inside it.",
      "Want to manage tasks from Telegram, Slack, Discord or other chat apps.",
      "Want automatic recovery of stalled tasks and an API to build on.",
    ],
    verdict: "Choose AI4Kanban for **specialist workflows, draft approval before the build and suggested follow-up work**; choose Hermes Kanban for **chat-app control, automatic recovery and an API**.",
    note: "Compared against the Hermes Agent v0.21.6 documentation, checked October 2026.",
  },
};

export default en;
