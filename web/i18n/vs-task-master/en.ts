// English copy for the Taskmaster comparison — the source of truth the other
// four languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const en: VsTaskMasterCopy = {
  meta: {
    title: "WildCrane vs. Taskmaster: review drafts, reduce rework",
    socialTitle: "WildCrane vs. Taskmaster",
    description: "Compare WildCrane and Taskmaster on specialist workflows, draft review, preference memory, and how tasks move from planning to execution.",
    social: "Compare WildCrane and Taskmaster on specialist workflows, draft review, preference memory, and how tasks move from planning to execution.",
  },
  hero: {
    badge: "Comparison",
    title: "WildCrane vs.\nTaskmaster",
    lead: "Compare WildCrane and Taskmaster on specialist workflows, draft review, preference memory, and how tasks move from planning to execution.",
    sharedLabel: "Both support",
    setup: {
      heading: "Specialist agents and workflows, ready to use",
      ours: "Built-in specialist agents and workflows cover product development and marketing content. Start with the workflow for your task instead of designing the team yourself. You can also create custom agents and workflows.",
      theirs: "Focused on coding tasks. No built-in specialist agents or workflows for UI design, copywriting or content production.",
      art: {
        ours: [
          "UI design",
          "Prompts",
          "Copy",
        ],
        theirs: {
          title: "Specialist workflows",
          fields: [
            "UI design",
            "Copywriting",
            "Content production",
          ],
          slot: "Not built in",
        },
      },
      shared: [
        {
          title: "Task breakdown and dependencies",
          body: [
            "WildCrane splits work into cards and subtasks, with dependencies controlling execution order.",
            "Taskmaster can generate tasks and subtasks from a PRD and manage dependencies.",
          ],
        },
        {
          title: "CLI integration",
          body: [
            "WildCrane provides a CLI that coding agents can call. It has no MCP server.",
            "Taskmaster provides both a CLI and an MCP server.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Review key drafts before implementation",
      ours: "Parts that need your judgment get a draft first. Review and edit it on the card; agents build from the approved version and handle the remaining details within the agreed scope. Catch changes here to reduce rework later.",
      theirs: "You can review task descriptions, implementation details and test strategies. There is no built-in preview and approval workflow for key output drafts before execution.",
      art: {
        ours: [
          "Key draft",
          "Approve direction",
          "Run the task",
        ],
        theirs: {
          title: "Task details",
          fields: [
            "Requirements",
            "Implementation",
            "Test strategy",
          ],
          slot: "Text task details",
        },
      },
      shared: [
      ],
    },
    memory: {
      heading: "Carry your preferences into the next task",
      ours: "Each agent remembers preferences and decisions relevant to its work and can share project context with other agents. Later tasks build on what you have already agreed, so you spend less time explaining the same background.",
      theirs: "It stores rules and task notes. It has no memory system that automatically learns preferences from user edits and rejections for future tasks.",
      art: {
        ours: {
          agents: [
            "UI designer",
            "Copywriter",
          ],
          notes: [
            "Design preferences",
            "Wording decisions",
          ],
          shared: "Shared project context",
        },
        theirs: {
          title: "Rules and task notes",
          fields: [
            "Project constraints",
            "Progress notes",
            "Added context",
          ],
          slot: "Rules and notes only",
        },
      },
      shared: [
        {
          title: "Editable rules",
          body: [
            "WildCrane’s specialist agents have editable role rules.",
            "Taskmaster provides rule files for different editors.",
          ],
        },
        {
          title: "Keeping work context",
          body: [
            "WildCrane keeps plans, conversations and run records on the card.",
            "Taskmaster retains task descriptions, implementation details and subtask notes.",
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
    lead: "See which workflows, review steps and integrations each product includes.",
    ourLabel: "WildCrane",
    theirLabel: "Taskmaster",
    rows: {
      startingPoint: {
        dimension: "Built-in agents and workflows",
        kanban: "Built-in specialist agents and workflows for development and content. Create your own agents and workflows. All built-in and custom workflows are free.",
        taskMaster: "Coding workflows for task execution, testing and code cleanup. No built-in specialist agents or workflows for design, copywriting or content production.",
      },
      planning: {
        dimension: "Task breakdown and dependencies",
        kanban: "WildCrane splits work into cards and subtasks, with dependencies controlling execution order.",
        taskMaster: "Taskmaster can generate tasks and subtasks from a PRD and manage dependencies.",
      },
      drafts: {
        dimension: "Key draft review before execution",
        kanban: "Image, diagram, HTML/TSX, diff and storyboard drafts. Approved key content becomes part of the execution requirements.",
        taskMaster: "You can review task descriptions, implementation details and test strategies. There is no built-in preview and approval workflow for key output drafts before execution.",
      },
      discussion: {
        dimension: "Chat on a task",
        kanban: "Discuss requirements and revise plans with agents on the card. Conversations stay with the card.",
        taskMaster: "No built-in task chat interface. Discuss tasks in the agent chat of tools such as Cursor.",
      },
      memory: {
        dimension: "Preference memory",
        kanban: "Agents remember your design preferences, wording choices and other decisions, and can share project context.",
        taskMaster: "It stores rules and task notes. It has no memory system that automatically learns preferences from user edits and rejections for future tasks.",
      },
      followUps: {
        dimension: "Suggestions after delivery",
        kanban: "Agents propose follow-up work after a main task. You accept, change or decline it.",
        taskMaster: "next only selects existing tasks. There is no built-in workflow that automatically proposes new follow-up tasks after delivery.",
      },
      interface: {
        dimension: "Board and interface",
        kanban: "A standalone desktop board for cards, drafts, conversations and run status.",
        taskMaster: "The official visual Kanban board is a VS Code extension. Core task management also works through CLI/MCP.",
      },
      execution: {
        dimension: "Execution and validation",
        kanban: "Run independent cards in parallel in the background, or use dependencies to run them in order. Development tasks use isolated git worktrees and required checks.",
        taskMaster: "loop runs a fresh Claude Code session for each iteration, completing one task at a time and running tests and type checks.",
      },
      testFirst: {
        dimension: "Built-in test-first workflow",
        kanban: "Development tasks run required checks. No built-in RED → GREEN → COMMIT workflow.",
        taskMaster: "autopilot guides each subtask through a failing test, implementation until tests pass, then a commit. It tracks phases and checks reported test results.",
      },
      research: {
        dimension: "Research",
        kanban: "Agents can research with the tools available in Claude Code, Codex or another execution tool. No dedicated research command or research-model setting.",
        taskMaster: "research accepts task and file context, uses a separately configured research model, and can save findings to a task or research file.",
      },
      reach: {
        dimension: "CLI and MCP",
        kanban: "A CLI that coding tools such as Claude Code and Codex can call. No MCP server.",
        taskMaster: "Both CLI and MCP, for use with MCP-compatible editors and coding agents.",
      },
      license: {
        dimension: "License",
        kanban: "Apache-2.0, including commercial use, hosting and embedding.",
        taskMaster: "MIT with Commons Clause, restricting sales of Taskmaster itself and offering it as a hosted service.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recommendation",
      title: "Which should you choose?",
    },
    oursHeading: "Choose WildCrane if you",
    theirsHeading: "Choose Taskmaster if you",
    ours: [
      "Want ready-to-use specialist agents and workflows for coding, blogs and videos.",
      "Want to change key details in a draft before agents complete the work.",
      "Want agents to reuse your preferences so later tasks need fewer corrections.",
    ],
    theirs: [
      "Want to manage tasks through MCP in your existing editor or coding agent.",
      "Want a dedicated research command with task context and a separate research model.",
      "Want a built-in workflow that guides coding through failing tests, passing tests and commits.",
    ],
    verdict: "Choose WildCrane for **ready-to-use specialist workflows and key drafts that reduce rework**; choose Taskmaster for **MCP integration, a dedicated research command and a built-in test-first coding workflow**.",
    note: "This page compares open-source Taskmaster. Hamster is a hosted product from the same team; its team features are outside this comparison.",
  },
};

export default en;
