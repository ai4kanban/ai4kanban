// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title: "Agent workspace for indie hackers | AI4Kanban",
    description:
      "From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review them, then let agents handle the execution details.",
    socialTitle: "You don’t have to manage every detail.",
    social:
      "Review the parts that need your judgment. Let agents take care of the execution, from coding to marketing.",
    schema:
      "AI4Kanban is an agent workspace for indie hackers. Six built-in workflows identify decisions that need human input and prepare drafts for approval before agents execute. Users can create custom agents and workflows that define what they review and what agents handle.",
  },

  hero: {
    eyebrow: "Agent workspace for indie hackers",
    title: "You don’t have to\nmanage every detail.",
    lead:
      "From coding to marketing, AI4Kanban brings you drafts of the parts that need your judgment. Review, refine, and let agents take it from there.",
    ctaDownload: "Download",
    ctaGithub: "View on GitHub ↗",
    image:
      "A recording of AI4Kanban: planning a task, reviewing its drafts, and handing the approved plan to agents.",
  },

  handoff: {
    title: "Review the key parts.\nLet agents do the rest.",
    body: [
      "AI4Kanban helps you clarify your idea. Each workflow brings you drafts of the parts that need your input. Review and refine them, then let agents complete the work. Tasks that don’t depend on each other move forward at the same time.",
    ],
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
    title: "The right workflow for the work",
    lead:
      "Start with six built-in workflows for coding and content. Each makes clear what you review before agents take over. You can also create your own agents and workflows.",
    items: [
      {
        label: "Coding",
        body: "Review the UI and copy that need your input. Agents implement the approved plan.",
        image: "Coding draft: a UI mockup of a key screen.",
      },
      {
        label: "Video clone (code-generated videos)",
        body: "Review the reference breakdown and recreation storyboard. Agents recreate the video and make a reusable template.",
        image: "Video clone drafts: the source breakdown and recreation storyboard.",
      },
      {
        label: "Product video",
        body: "Review the script and storyboard. Agents produce the video and cover.",
        image: "Product video draft: scenes and voiceover in a storyboard.",
      },
      {
        label: "Slide deck",
        body: "Review the slide content and layout. Agents produce a PowerPoint deck with each slide as an image.",
        image: "Slide deck draft: page content and layout previews.",
      },
      {
        label: "Carousel post",
        body: "Review the page copy and outline. Agents create the page images and platform captions.",
        image: "Carousel post draft: page copy and content outline.",
      },
      {
        label: "Blog post",
        body: "Review the outline, copy and images. Agents prepare the complete article.",
        image: "Blog post draft: the article and its images.",
      },
    ],
    links: {
      demo: "Try the demo",
      all: "See all agents and workflows",
    },
  },

  tools: {
    title: "Keep the AI tools you already use",
    body:
      "Connect Claude Code and 7 other tools, running on your machine with your own subscriptions. Choose a tool and model for each agent. AI4Kanban charges no extra token fees.",
  },

  start: {
    title: "Bring your next idea",
    lead: "Download the desktop app, open your project and talk through what you want to do.",
    cta: "Download",
    firstOpen:
      "The macOS app is unsigned. If macOS blocks it on first open, follow the steps on the download page.",
  },
};

export default en;
