// English copy for the welcome tour — the source of truth a second language mirrors key for
// key. Writing rules: `i18n/index.ts`.
import type { TourCopy } from "./types";

const en: TourCopy = {
  dialog: "Welcome tour",
  noteLabel: "Does this use extra tokens?",
  skip: "Skip",
  back: "Back",
  next: "Next",
  done: "Get started",
  pages: [
    {
      title: "See a draft before the build",
      pain: "More ideas than you can digest, and you've become the bottleneck?",
      value: "Agents turn each idea into a draft first. A UI mockup says more than any spec.",
      note: "Each task spends some extra tokens on planning and drafts, so you can approve work with little effort. Turn off planning agents that don't help in Configuration → Workflows → Coding.",
    },
    {
      title: "Own the main line. Agents cover the gaps.",
      pain: "Zero to one is easy. Filling every gap is hard.",
      value: "Agents point out what's missing, so you can think about bigger problems.",
      note: "Agents spend tokens in the background now and then looking for gaps, saving you time on details. Don't need it? Pause Suggest follow-up work in Configuration → Board.",
    },
    {
      title: "More than code",
      pain: "A team of one, with no time for marketing?",
      value: "Put it all on the board. Videos, carousels, blog posts and emails move forward together.",
    },
    {
      title: "Gets better as you go",
      pain: "Does your AI keep making the same mistakes?",
      value: "Memory is split by agent and by module, so each run recalls exactly what it needs with less context.",
      note: "Summarizing chats and tidying memory takes a few tokens and makes later plans more accurate. Pause Review chats and Tidy memory in Configuration → Board.",
    },
    {
      title: "Let agents be your users",
      tag: "Experimental",
      pain: "Want to know how your product really feels to use?",
      value: "Agents act as users, walk through every scenario and feature, and give you honest feedback.",
      note: "Agents spend tokens in the background now and then trying your finished work as a user. Turn it off in Configuration → Workflows → Coding → Scheduled.",
    },
  ],
  draft: { idea: "Add a dark mode", spec: "Spec", skip: "No need to read", approve: "Approve", approved: "Building" },
  gaps: {
    main: "Dark mode",
    done: "Done",
    found: "Agents found 3 gaps",
    rows: ["Settings preview ignores dark mode", "Email template ignores dark mode", "No test for the theme switch"],
    add: "Add",
    added: "Added",
  },
  flows: { doing: "In progress", done: "Done", cards: ["Dark mode", "Product video", "Launch carousel", "Launch blog post", "Update email"] },
  memory: {
    says: ["Don't make confirm buttons red", "Keep every setting in Configuration"],
    agents: "Agents",
    modules: "Modules",
    files: ["ui-designer", "copywriting", "local-ui", "site"],
  },
  qa: {
    signup: "Sign up",
    email: "Email",
    export: "Export",
    steps: ["Sign up", "Log in", "Export"],
    label: "QA feedback",
    feedback: "On phones, the Export button is hidden under the bottom bar",
  },
  replay: { note: "What AI4Kanban does for you, in five pages.", button: "View again" },
};

export default en;
