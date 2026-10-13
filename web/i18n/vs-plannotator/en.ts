import type { VsPlannotatorCopy } from "./types";

const en: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator: review drafts, run tasks",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Want to review key drafts and run tasks in parallel? Compare AI4Kanban's specialist agents and task board with Plannotator's plan, document and code review.",
    social:
      "Plannotator brings plan, document and code review into your agent sessions. AI4Kanban brings key drafts, parallel delivery, memory and follow-ups to a task board.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs. Plannotator",
    lead: "Plannotator lets you annotate your coding agent's plans, documents and code. AI4Kanban organizes tasks on a board: built-in specialist agents prepare key drafts for your approval, then run tasks in parallel in the background.",
  },
  both: {
    title: "What both support",
    items: [
      "Review plans before execution",
      "Send annotations back to the agent",
      "Work with multiple coding agents",
      "View code diffs",
      "Free and open source",
    ],
  },
  theirs: {
    title: "Plannotator: review within your agent session",
    intro:
      "Plannotator connects to your coding agent through hooks and commands. Supported plan hooks open a local browser review. Approve the plan or send it back with annotations, check the plan diff, and continue in the same session.",
    more: [
      {
        title: "Review more than plans",
        body: "Annotate Markdown, folders, URLs, HTML drafts or the agent's last message. Review local code changes, GitHub PRs and GitLab MRs. Ask AI questions during review, or run an AI code review that adds findings to the diff.",
      },
      {
        title: "Share a review",
        body: "Share a link for others to annotate, then import their feedback. Small shares use URL fragments; larger content and HTML use encrypted short links. Open-source link sharing remains available with deprecated support. Team collaboration is moving to Workspaces, still marked as coming soon on the site.",
      },
    ],
    links: ["Explore Plannotator", "Plannotator README"],
  },
  ours: {
    title: "AI4Kanban: review key drafts, move several tasks forward",
    lead: "AI4Kanban organizes coding agents' work on a task board, with built-in specialists for UI design, copywriting and competitor research. You help plan the work and approve key drafts, then agents execute in the background. Tasks without dependencies can run together.",
    drafts: {
      title: "Review what you would want to change",
      body: "Worried about AI taking liberties with a screen, prompt or piece of copy? Parts that need your decision get a draft first; agents build from the approved draft. Beyond plans and HTML, preview images, diagrams and storyboards. Agents handle the remaining details directly.",
      art: ["Draft", "Approve", "Execution"],
    },
    parallel: {
      title: "Move several tasks forward together",
      body: "The board keeps tasks, dependencies and progress together. Once requirements are settled, independent tasks run in parallel. Read logs and code diffs from each card without watching every session during execution.",
      art: ["Login page", "Pricing copy", "API fix"],
    },
    memory: {
      title: "Explain less next time",
      body: "Each agent uses memory designed for its job to learn your preferences and decisions. Agents can share that memory. After a main piece of work is finished, they propose follow-ups to help fill gaps and catch omissions.",
      art: { agents: ["UI design", "Copywriting"], shared: "Shared · project context" },
    },
    custom: "You can also create custom agents and workflows.",
    tipLabel: "Tip",
    tip: "The software development workflow is free. Blog, social carousel, slide deck and product video workflows require Pro.",
  },
  compare: {
    title: "What comes built in",
    head: "Capability",
    yes: "Included",
    no: "Not included",
    how: {
      label: "How work runs",
      theirs: "Open a review in your current agent session",
      ours: "Start agents from task cards to run in the background",
    },
    rows: {
      plans: { label: "Review plans and return feedback before execution" },
      html: { label: "Preview HTML drafts" },
      images: { label: "Review image and storyboard drafts" },
      planDiff: { label: "Show differences between plan revisions" },
      askAi: {
        label: "Ask AI during review",
        theirs: "Questions in the review surface",
        ours: "Conversation on the card",
      },
      codeDiff: { label: "View code diffs", ours: "Delivery Diff tab" },
      aiReview: { label: "AI review findings on code diffs" },
      prs: { label: "Review GitHub PRs and GitLab MRs" },
      share: { label: "Share review links", theirs: "Deprecated OSS support" },
      board: { label: "Task board with dependencies and parallel execution" },
      agents: { label: "Built-in specialist agents and workflows" },
      memory: { label: "Memory of preferences and decisions, shared across agents" },
      followUps: { label: "Follow-up suggestions after a main task is completed" },
    },
    note: "This compares built-in capabilities. Plannotator's local history and Obsidian or Bear exports save review records; they are distinct from agent memory used in later tasks.",
  },
  decision: {
    title: "Which fits your work?",
    theirs: {
      name: "Choose Plannotator",
      body: "You want to review plans, documents and code around the agent you already use, checking each revision. You also need PR review or shared annotations.",
    },
    ours: {
      name: "Choose AI4Kanban",
      body: "You want to move several tasks forward: approve key UI and copy drafts, let agents execute, and carry your preferences and decisions into later tasks.",
    },
  },
  start: {
    title: "Ready to coordinate several tasks?",
    body: "Download AI4Kanban. Plan with precision, ship at speed.",
    cta: "Download AI4Kanban",
  },
};

export default en;
