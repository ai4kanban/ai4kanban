// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title: "Agent workspace for indie hackers | AI4Kanban",
    description:
      "Specialist agents draft the key parts of coding and marketing tasks for you to review, then finish the work—so you spend less time checking and reworking it.",
    socialTitle: "See the draft. Let agents do the rest.",
    social:
      "Specialist agents handle coding and marketing. Review the key drafts, then hand over the work—with less to check and revise afterwards.",
    schema:
      "AI4Kanban is an open-source, local-first agent workspace for indie hackers. Specialist agents share project context across 6 coding and content workflows. They draft the parts that need your judgment, then finish the work from what you approve, reducing the time you spend checking and revising finished work. Independent tasks run in parallel, preferences and decisions carry forward, and agents suggest follow-ups. Use your own AI tools and subscriptions.",
  },

  hero: {
    eyebrow: "An agent workspace for indie hackers",
    title: "See the draft.\nLet agents do the rest.",
    lead:
      "From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review, refine, and let agents take it from there—without having to manage every detail.",
    ctaDownload: "Download",
    ctaGithub: "View on GitHub ↗",
    image:
      "A recording of the AI4Kanban demo board: planning tasks, reviewing the drafts on a card, then handing the work to agents.",
  },

  review: {
    title: "Review the key parts.\nAgents do the rest.",
    lead:
      "AI4Kanban turns the parts of your idea that need your judgment into drafts you can review and refine. Once you approve them, agents finish the work from those drafts, freeing you to focus on other things.",
    scene: {
      label:
        "You hand an idea to AI4Kanban, which turns it into drafts for you to review. Once you approve them, AI4Kanban passes the drafts and their context to agents, who take over the work.",
      idea: "Launch a Pro plan",
      you: "You",
      board: "AI4Kanban",
      agent: "Agent",
      review: "You review",
      build: "Agents take over",
    },
  },

  workflows: {
    title: "Build the product. Keep marketing moving.",
    lead:
      "Across 6 built-in workflows for coding and content creation, review UI mockups, article copy and images, video storyboards and more before agents finish the work.",
    items: [
      { label: "Coding", image: "Coding draft: a UI mockup of a key screen." },
      { label: "Blog post", image: "Blog post draft: the article and its images." },
      {
        label: "Product video",
        image: "Product video draft: scenes and voiceover in a storyboard.",
      },
      { label: "Slide deck", image: "Slide deck draft: page content and layout previews." },
      { label: "Carousel post", image: "Carousel post draft: page copy and content outline." },
      {
        label: "Video clone (code-generated videos)",
        image: "Video clone drafts: the source breakdown and clone storyboard.",
      },
    ],
    links: {
      demo: "Try the demo",
      coding: "Explore the coding workflow",
      all: "See all agents and workflows",
    },
  },

  parallel: {
    title: "Move independent work forward together",
    body: [
      "Keep product development and marketing tasks on one board. Independent tasks can run in parallel; dependent tasks follow in order.",
      "Each card keeps its own drafts, decisions and progress. Return to the card when a decision needs you, and let agents handle execution without repeated handoffs across chats.",
    ],
    shots: {
      board: { label: "Board", alt: "The AI4Kanban board: Board view" },
      card: { label: "Card", alt: "The AI4Kanban board: a card's details and requirements" },
      frontAria: "{view} view (current)",
      flipAria: "Switch to the {view} view",
    },
  },

  agents: {
    title: "Start the next task with what you've already agreed",
    body: [
      "Your preferences and decisions carry forward. Each agent remembers what matters to its work and can share that context with other agents.",
      "The next draft builds on that shared understanding, so you spend your time on what needs to change this time.",
    ],
    image: "You give a note once; the agent remembers it and every later draft follows it.",
  },

  followUps: {
    title: "Finish one piece of work. Catch what comes next.",
    body: [
      "After a main piece of work is complete, agents suggest follow-ups to help catch gaps and identify useful next steps.",
      "Suggestions come back to your board. Accept, revise or reject them before deciding what to take on.",
    ],
    image: "The QA agent finds a gap and hands you a follow-up to accept or dismiss.",
  },

  tools: {
    title: "Keep the AI tools you already use",
    body:
      "Connect Claude Code, Codex and 6 other tools, running on your machine with your own subscriptions. Choose a tool and model for each agent. AI4Kanban charges no extra token fees.",
  },

  start: {
    title: "Start with your first task",
    lead:
      "Download the desktop app, open a project and write what you want to do. Review the drafts that need your judgment, then hand the rest to agents.",
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then choose to continue in the warning. The download page has the full steps for macOS, Windows and Linux.",
    command: "Prefer the command line? Run `npx ai4kanban@latest install` in your project.",
  },
};

export default en;
