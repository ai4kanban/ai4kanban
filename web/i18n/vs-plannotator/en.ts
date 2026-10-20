import type { VsPlannotatorCopy } from "./types";

const en: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator: from key drafts to delivery",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Compare AI4Kanban and Plannotator on draft and code review, specialist workflows, parallel tasks and how work continues after approval.",
    social:
      "Compare AI4Kanban and Plannotator on draft and code review, specialist workflows, parallel tasks and how work continues after approval.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs. Plannotator",
    lead: "Compare AI4Kanban and Plannotator on draft and code review, specialist workflows, parallel tasks and how work continues after approval.",
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
    title: "AI4Kanban: from key drafts to finished work",
    lead: "Specialist agents prepare the UI, copy or script you need to review. After you approve those key parts, the workflow carries the task through. Coding, blog and video workflows are built in; independent tasks can run in parallel.",
    drafts: {
      title: "Review what you would want to change",
      body: "Parts that need your judgment get a draft first. Review and edit it on the card; agents build from the approved version and handle the remaining details within the agreed scope. Catch changes here to reduce rework later.",
      art: ["Draft", "Approve", "Execution"],
    },
    parallel: {
      title: "Move several tasks forward together",
      body: "Keep development and marketing tasks on one board, with drafts, decisions and progress on each card. Once requirements are settled, independent tasks run in parallel; dependent tasks follow in order.",
      art: ["Login page", "Pricing copy", "API fix"],
    },
    memory: {
      title: "Explain less next time",
      body: "Each agent remembers preferences and decisions relevant to its work and can share project context with other agents. Later tasks build on what you have already agreed. After a main piece of work is complete, agents suggest follow-ups for you to accept, revise or reject.",
      art: { agents: ["UI design", "Copywriting"], shared: "Shared · project context" },
    },
    custom: "You can also create custom agents and workflows.",
    tipLabel: "Tip",
    tip: "The software development workflow is free. Blog, social post, slide deck, product video and video clone workflows require Pro.",
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
      body: "Review key drafts on the task card, then let agents finish the work. Built-in workflows cover coding and marketing, with independent tasks moving in parallel. Agents reuse your preferences on later tasks, so you spend less time repeating corrections.",
    },
  },
  start: {
    title: "Ready to coordinate several tasks?",
    body: "Download AI4Kanban. Plan with precision, ship at speed.",
    cta: "Download AI4Kanban",
  },
};

export default en;
