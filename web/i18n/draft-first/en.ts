import type { DraftFirstCopy } from "./types";

const en: DraftFirstCopy = {
  meta: {
    title: "draft-first: Preview AI drafts before the build",
    description:
      "Cut the rework. Your coding agent drafts the screens, prompts and copy first, and builds from the drafts you confirm.",
  },
  schema:
    "draft-first is a skill for Claude Code, Codex, Cursor, OpenCode and other coding agents. It presents screen drafts, prompts with sample outputs, copy, images, library choices and competitor comparisons for review. Once you revise and confirm them, the agent implements the selected screens, wording and choices, reducing guesswork during the build.",
  hero: {
    title: ["See the draft.", "Then build."],
    lead: "Your coding agent drafts the screens, prompts and copy. You review and revise them; then it builds from the version you confirm.",
    update: "Run again to update.",
    worksWith: "Works with",
    alt: "A draft-first review page: a draft is deleted, another gets a note, and the page is confirmed.",
  },
  drafts: {
    title: "Draft the parts that matter",
    lead: "Does your AI keep getting the details wrong? Review drafts of the key parts, revise and confirm them, then let it build from those drafts.",
    kinds: [
      ["Screens", "preview what the page will look like."],
      ["Prompts", "read the prompt and sample outputs."],
      ["Copy", "read what your AI has written."],
      ["Images", "see the images before choosing one."],
    ],
    more: "It also drafts library choices and competitor comparisons.",
    closing: "Leave the rest to your agent.",
  },
  review: {
    title: "Get the draft right. Then build from it.",
    actions: [
      ["Delete", "Remove an option you do not want."],
      ["Note", "Leave feedback on a draft."],
      ["Confirm", "Save the version your agent will build from."],
    ],
    export: "Export an image or a single HTML file to share. The HTML file opens in a browser; nothing is uploaded.",
  },
  helpers: {
    title: "You choose what gets drafted",
    lead: "Six drafting agents are included. Want storyboards before your AI makes a video? Add .draft-first/helpers/storyboard.md with instructions to list each scene’s visuals and narration.",
    example: "Example: a video storyboard agent",
    file: ".draft-first/helpers/storyboard.md",
    description: "A video being created or changed.",
    body: "List each scene in order, with one line for what the viewer sees and one line for the narration.",
  },
  upgrade: {
    title: "Too many tasks? Bring them to AI4Kanban.",
    lead: "Move your drafts onto an AI4Kanban board to plan, review and run multiple tasks in one place.",
    cards: [
      ["Remember your preferences", "Agents reuse your preferences and decisions, so you explain less next time."],
      ["Run tasks in parallel", "Independent tasks run at the same time; tasks that depend on others wait for their results."],
      ["Catch the follow-ups", "After finishing a task, agents propose follow-ups for work still needed."],
    ],
    explore: "Explore AI4Kanban",
    download: "Download AI4Kanban",
  },
  faq: {
    title: "FAQ",
    items: [
      ["Where are my drafts stored?", "In .draft-first/ at your project root. It contains the drafts, notes and confirmed files your agent uses to build."],
      ["Which agents are supported?", "Any coding agent that reads skills from .claude/skills/ or .agents/skills/."],
      [
        "How do I uninstall it?",
        "Delete the draft-first folders from .claude/skills/ and .agents/skills/. To remove the project's drafts too, back up anything you want to keep, then delete .draft-first/ from that project.",
      ],
    ],
  },
};

export default en;
