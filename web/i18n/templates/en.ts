import type { TemplatesCopy } from "./types";

const en: TemplatesCopy = {
  meta: {
    title: "AI4Kanban: Templates",
    description:
      "Browse templates by category. View images and compare the original work with its recreation before using a template in AI4Kanban.",
  },
  title: "Templates",
  lead: "Browse by category.",
  categories: {
    ui: { name: "UI", title: "UI templates", back: "Back to UI templates" },
    video: { name: "Video", title: "Video templates", back: "Back to video templates" },
    prop: { name: "Props", title: "Props", back: "Back to props" },
    motion: { name: "Motion", title: "Motion", back: "Back to motion" },
  },
  tabs: "Categories",
  pages: "Pages",
  prev: "Previous",
  next: "Next",
  back: (title) => `Back to ${title}`,
  all: "All categories",
  free: "Free",
  pro: "Pro",
  original: "Original",
  recreation: "Recreation",
  originalVideo: "Original video",
  recreationVideo: "Recreation",
  keyframe: "Keyframe",
  preview: "Preview",
  pause: "Pause",
  pieceNote: "Works inside a video template; it can't run on its own.",
  play: "Play",
  noPreview: "No preview yet",
  tags: "Tags",
  use: "Use this template",
  useLead: "Paste it into AI4Kanban and add your topic.",
  prompt: (category, name) => {
    switch (category) {
      case "video":
        return `Use the AI4Kanban video template "${name}" to make: <describe your product and what the video should show>`;
      case "ui":
        return `Use the AI4Kanban UI template "${name}" to design: <describe the page or screen>`;
      case "prop":
      case "motion":
        return `Make a video with AI4Kanban using the ${category} "${name}": <describe your video>`;
      default:
        return `Use the AI4Kanban ${category} template "${name}" to make: <describe what you want>`;
    }
  },
  copyPrompt: "Copy prompt",
  copied: "Copied",
  source: "Source",
  site: "Site",
  reference: "Reference",
  captured: "Captured",
  originalWork: "Original template",
  loading: "Loading templates…",
  unavailable: "Templates could not be loaded.",
  retry: "Retry",
  empty: "No templates yet.",
  missing: "This template is not available.",
  videoFailed: "This video could not be played.",
  openYouTube: "Open on YouTube",
  openOriginal: "Open the original",
  detailTitle: (title) => `${title} | AI4Kanban Templates`,
};

export default en;
