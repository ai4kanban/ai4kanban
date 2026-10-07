import type { VsMulticaCopy } from "./types";

const en: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica: move projects forward with AI agents",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Compare AI4Kanban and Multica: the problems each solves, the setup and review work they save you, and how their approaches to working with AI agents differ.",
    social:
      "Both let you create and organize multiple teams of AI agents to work in parallel. AI4Kanban includes ready-to-use agents, workflows and memory management, reducing the effort of designing a team and tuning its prompts.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nMultica",
    lead: "AI4Kanban comes with specialist agents and workflows, ready out of the box: hand off your first piece of work in 10 minutes. Agents run in parallel, drafts keep the quality of every delivery in your hands, and they keep learning as they go.",
    sharedLabel: "Both have",
    setup: {
      heading: "Start working without designing the team first",
      verdict:
        "Specialist agents come ready, so you hand off work on day one.",
      ours: "Built-in specialist agents and workflows cover software development, blogs, social carousels, slide decks and product videos.",
      theirs:
        "Apart from the coordinator Mika, you create and configure every specialist agent yourself",
      art: {
        ours: ["UI designer", "Prompt writer", "Copywriter"],
        theirs: {
          title: "New agent",
          fields: ["Name", "Instructions", "Skills"],
          slot: "Yours to create",
        },
      },
      shared: [
        {
          title: "Custom agents",
          body: [
            "AI4Kanban lets you edit the built-in roles or add your own agents.",
            "Multica’s Agent Builder helps you create roles, then configure their Instructions and Skills.",
          ],
        },
        {
          title: "Agents in parallel",
          body: [
            "AI4Kanban runs several cards at once with coding tools such as Claude Code or Codex.",
            "Multica runs agents in parallel, with queues, retries and cost tracking.",
          ],
        },
      ],
    },
    drafts: {
      heading:
        "Worried about AI taking too many liberties? Review a draft before approving execution",
      verdict: "Fix the direction before the run, not after it.",
      ours: "For any part where you want control over the direction, the draft system can prepare a preview for your approval before execution and delivery. AI4Kanban supports image, diagram, HTML/TSX, diff and storyboard drafts.",
      theirs: "You build the draft-review process yourself",
      art: {
        ours: ["Draft", "Approve", "Run the task"],
        theirs: {
          title: "Draft approval",
          fields: ["Who drafts", "When to wait", "How to hand off"],
          slot: "Yours to build",
        },
      },
      shared: [
        {
          title: "Previews",
          body: [
            "AI4Kanban displays image, diagram, HTML/TSX, diff and storyboard drafts on the card.",
            "Multica previews HTML, collects annotations and compares versions.",
          ],
        },
        {
          title: "Task discussion",
          body: [
            "AI4Kanban discusses and revises the plan in the card chat.",
            "Multica discusses work with agents in issue comments.",
          ],
        },
      ],
    },
    memory: {
      heading: "Will you need to explain it again?",
      verdict:
        "Preferences and decisions are kept per task, so you never repeat them.",
      ours: "Each agent has a memory recipe designed for its own job: it learns your preferences and decisions for that kind of task, not generic lessons. Agents can also share memory with each other.",
      theirs:
        "Long-term memory depends on the agent tool, for you to check and set up",
      art: {
        ours: {
          agents: ["UI designer", "Copywriter"],
          notes: ["Design preferences", "Wording calls"],
          shared: "Shared · project",
        },
        theirs: {
          title: "Long-term memory",
          fields: ["Which tool", "Where it’s kept", "When it’s read"],
          slot: "Yours to set up",
        },
      },
      shared: [
        {
          title: "Saved methods",
          body: [
            "AI4Kanban gives every agent role rules you can edit.",
            "Multica keeps methods in Instructions and Skills.",
          ],
        },
        {
          title: "Task history",
          body: [
            "AI4Kanban keeps the plan, chat and run log on each card.",
            "Multica keeps comments and run history.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "Key differences", title: "Compare the details" },
    lead: "A {check} marks the stronger side on each row.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Built-in agents and workflows",
        kanban:
          "Built-in specialist agents and workflows, with roles you can edit or add.",
        kanbanTip:
          "Software development is free; blog, social carousel, slide deck and product video workflows require Pro.",
        multica:
          "Mika is included. Create specialist agents yourself or with Agent Builder, then give them Instructions and Skills.",
      },
      refinement: {
        dimension: "Reviewing drafts before execution",
        kanban:
          "For any part where you want control over the direction, the draft system can prepare a preview for your approval before execution and delivery. AI4Kanban supports image, diagram, HTML/TSX, diff and storyboard drafts.",
        multica:
          "Preview HTML, annotate output and compare versions. You define which agent prepares each draft and when approval is needed before execution.",
      },
      memory: {
        dimension: "Remembering edits and decisions",
        kanban:
          "Each agent has a memory recipe designed for its own job: it learns your preferences and decisions for that kind of task, not generic lessons. Agents can also share memory with each other.",
        multica:
          "Long-term memory depends on the agent tool. Agents using Hermes each retain memory across tasks on the local runtime; it does not automatically sync across machines. Instructions and task history are also saved.",
      },
      backlog: {
        dimension: "What comes after delivery",
        kanban:
          "After you finish a main piece of work, agents proactively suggest follow-ups to help fill gaps and catch omissions.",
        multica:
          "To get follow-up suggestions, request them in the task instructions. Autopilot runs automatically after you configure its runbook, assignee and schedule or webhook triggers.",
      },
      license: {
        dimension: "License",
        kanban: "Apache-2.0, including commercial use, hosting, and embedding.",
        multica:
          "Source-available; hosted services and commercial embedding are restricted by the Multica License.",
      },
      execution: {
        dimension: "Execution management",
        kanban:
          "Run cards with Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness, ZCode or Grok Build, with several cards in progress at once.",
        multica:
          "Runs multiple agents in parallel, with queues, retries, replay, cost tracking, review gates, and PR and CI links.",
      },
      teams: {
        dimension: "Team collaboration",
        kanban:
          "For individuals and small teams organizing tasks in one repository, with customizable agents and workflows.",
        multica:
          "Multi-user workspaces, roles, Squads, comments, permissions, and notifications.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recommendation", title: "Which should you choose?" },
    oursHeading: "Choose AI4Kanban if you",
    theirsHeading: "Choose Multica if you",
    ours: [
      "Want built-in specialist agents and workflows without configuring them from scratch; some workflows require Pro.",
      "Want to review key drafts before execution.",
      "Want agents to remember useful edits and decisions across coding tools.",
      "Want planning and follow-up suggestions included, with room to customize the workflow.",
    ],
    theirs: [
      "Need multi-user workspaces, permissions and notifications for a whole team working on shared issues.",
      "Need execution management such as queues, retries, replay, cost tracking, and PR and CI links.",
      "Want to configure Autopilot’s runbook, assignee and triggers to start recurring work on a schedule or from external events.",
    ],
    verdict:
      "Choose AI4Kanban to **start with specialist agents, approve key drafts before execution, and keep your decisions remembered**. Choose Multica only if you **specifically need its multi-user workspace or execution management**.",
    note: "",
  },
};

export default en;
