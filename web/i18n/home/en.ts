// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title: "See the draft before agents get to work | AI4Kanban",
    description:
      "AI4Kanban prepares key drafts for tasks on your board. You review what matters, agents handle the details, and you move more work forward on your own.",
    socialTitle: "See the draft. Let agents do the rest.",
    social: "A kanban board for AI agents that shows you the key drafts first, then lets agents finish the rest.",
    schema:
      "AI4Kanban is an open-source, local-first kanban board for AI agents. It prepares the key drafts for each task — a UI mockup, a copy draft, a storyboard, figures — so you settle the direction first, then specialist agents finish the rest within the agreed scope. It covers product development and content creation, and connects to 8 tools such as Claude Code and Codex, running on your machine with your own subscriptions.",
  },

  hero: {
    eyebrow: "An agent workspace for indie hackers",
    title: "See the draft.\nLet agents do the rest.",
    lead: "From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review, refine, and let agents take it from there—without having to manage every detail.",
    ctaDownload: "Download",
    ctaGithub: "View on GitHub ↗",
    image:
      "A recording of the AI4Kanban demo board: planning tasks, reviewing the drafts on a card, then handing the work to agents.",
  },

  drafts: {
    title: "Review the key drafts. Get the direction right.",
    lead: "Agents put key drafts on the task card. Review and revise them before the rest of the work starts.",
    kinds: [
      { label: "UI mockup", body: "Preview layout and interactions." },
      { label: "Copy draft", body: "Confirm the message and wording." },
      { label: "Storyboard", body: "Review each shot and its voiceover." },
      { label: "Figures", body: "Check what each figure shows." },
    ],
    closing:
      "You don't have to spell out every detail. Once the key drafts are approved, agents finish the rest within the agreed scope.",
  },

  agents: {
    title: "Your feedback carries over to the next task.",
    body: [
      "A design agent prepares mockups, a copy agent polishes wording, a script agent plans the content. AI4Kanban comes with 5 workflows and 10+ specialist agents that split the work by task and remember the preferences and decisions you've made clear.",
      'Say you ask for "more direct headlines." The copy agent applies that feedback to future drafts. The next task starts from what you\'ve already agreed, so you never explain it from scratch.',
    ],
    pro: "Product videos, slide decks, carousel posts, and blog posts require Pro.",
    image: "You give a note once; the agent remembers it and every later draft follows it.",
  },

  followUps: {
    title: "Let agents catch what you missed.",
    body: [
      "As tasks pile up, finding every gap shouldn't be on you alone. Background agents check progress on a schedule, and a QA agent tests recent changes the way a user would.",
      "An overlooked error state or a missing test can become a follow-up suggestion on your board. You accept, revise or reject it, and agents carry on.",
    ],
    image: "The QA agent finds a gap and hands you a follow-up to accept or dismiss.",
  },

  parallel: {
    title: "Many things at once. The key calls stay yours.",
    body: [
      "A product change, a launch post, an intro video — no need to finish one before starting the next. Independent tasks go to agents in parallel; you review the key drafts on the cards, make the calls, and keep your attention for what's worth doing next.",
      "AI4Kanban handles task breakdown, priorities, progress and notifications, so you don't have to coordinate work across multiple chats.",
    ],
    shots: {
      board: { label: "Board", alt: "The AI4Kanban board: Board view" },
      card: { label: "Card", alt: "The AI4Kanban board: a card's details and requirements" },
      frontAria: "{view} view (current)",
      flipAria: "Switch to the {view} view",
    },
  },

  tools: {
    title: "Keep the AI tools you already use.",
    body: "Connect Claude Code, Codex and more; they run on your machine with your own subscriptions. 8 tools are supported, each agent can pick its own tool and model, and AI4Kanban charges no extra token fees.",
  },

  start: {
    title: "Write down an idea. See the draft first.",
    lead: "Open a project and write what you want to do. Start from the first key draft, set the direction, and hand the rest to agents.",
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then choose to continue in the warning. The download page has the full steps for macOS, Windows and Linux.",
    command: "Prefer the command line? Run `npx ai4kanban@latest install` in your project.",
  },
};

export default en;
