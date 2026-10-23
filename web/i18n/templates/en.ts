import type { TemplatesCopy } from "./types";

const en: TemplatesCopy = {
  meta: {
    title: "WildCrane: Templates",
    description:
      "Browse templates by category. View images and compare the original work with its recreation before using a template in WildCrane.",
  },
  title: "Templates",
  lead: "Browse by category.",
  categories: {
    ui: { name: "UI", title: "UI templates", back: "Back to UI templates" },
    video: { name: "Video", title: "Video templates", back: "Back to video templates" },
    prop: { name: "Props", title: "Props", back: "Back to props" },
    motion: { name: "Motion", title: "Motion", back: "Back to motion" },
    carousel: { name: "Carousel", title: "Carousel templates", back: "Back to carousel templates" },
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
  pageCount: (n) => `${n} pages`,
  preview: "Preview",
  pause: "Pause",
  pieceNote: "Works inside a video template; it can't run on its own.",
  play: "Play",
  noPreview: "No preview yet",
  tags: "Tags",
  use: "Use this template",
  useLead: "Paste it into WildCrane and add your topic.",
  prompt: (category, name) => {
    switch (category) {
      case "video":
        return `Use the WildCrane video template "${name}" to make: <describe your product and what the video should show>`;
      case "ui":
        return `Use the WildCrane UI template "${name}" to design: <describe the page or screen>`;
      case "carousel":
        return `Use the WildCrane carousel template "${name}" to make: <describe your topic>`;
      case "prop":
      case "motion":
        return `Make a video with WildCrane using the ${category} "${name}": <describe your video>`;
      default:
        return `Use the WildCrane ${category} template "${name}" to make: <describe what you want>`;
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
  detailTitle: (title) => `${title} | WildCrane Templates`,
};

export default en;
