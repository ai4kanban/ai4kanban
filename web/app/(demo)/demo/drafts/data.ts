// What the home page's six workflow previews draw: one English set, served from
// public/home/drafts/. The product video and the clone come from #1734's breakdown, the deck
// from #1696, each cut to the shots and slides a preview pages between.
import type { MockupView } from "ai4kanban-ui/lib/mockup-tag";
import type { Shot } from "ai4kanban-ui/lib/format/compare";
import type { StoryboardFrameView, StoryboardView } from "ai4kanban-ui/lib/storyboard";

const DIR = "/home/drafts";

export const KINDS = ["coding", "blog", "video", "slides", "carousel", "clone"] as const;
export type Kind = (typeof KINDS)[number];

export const TITLES: Record<Kind, string> = {
  coding: "Rework the home page around workflows",
  blog: "Rewrite the README opening",
  video: "Record a product demo video",
  slides: "Pitch deck: where people and agents split the work",
  carousel: "Carousel: stop reading AI's walls of text",
  clone: "Clone a product launch video",
};

/** The pages a paging preview goes back and forth over. */
export const PAGES: Partial<Record<Kind, number[]>> = {
  video: [4, 5],
  slides: [7, 8, 9],
  carousel: [1, 2, 3],
};

const frame = (href: string, alt = ""): StoryboardFrameView => ({ src: href, alt, href, ratio: null });

/** A long page, scrolled down and back up inside the prototype's frame. */
export function prototype(origin: string, still: boolean): MockupView {
  const motion = still
    ? ""
    : "img{animation:s 18s ease-in-out infinite}" +
      "@keyframes s{0%,10%{transform:translateY(0)}45%,55%{transform:translateY(calc(-100% + 100vh))}90%,100%{transform:translateY(0)}}" +
      "@media (prefers-reduced-motion:reduce){img{animation:none}}";
  return {
    src: ".assets/demo/home-desktop.html",
    doc: `<!doctype html><html><head><style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}img{display:block;width:100%}${motion}</style></head><body><img src="${origin}${DIR}/ui-home.jpg" alt=""></body></html>`,
  };
}

export const ARTICLE: MockupView = {
  src: ".assets/demo/README.md",
  article: {
    href: `${DIR}/README.md`,
    text: `---
title: AI4Kanban
dek: An agent workspace for indie hackers
---

AI4Kanban brings coding and marketing workflows into one agent workspace. Agents draft the parts that need your judgment—UI, copy, video scripts and more—for you to review and refine. Once you approve the drafts, agents finish the rest.

## Build and market your product

As an indie hacker, you need to build a product and get people to use it. Marketing can take as much time and attention as development—or more.

## How AI4Kanban helps

### 1. A specialist team for coding and marketing

AI4Kanban comes with 6 workflows and 10+ specialist agents for the work indie hackers do every day. Each agent owns a specific part of a workflow, such as UI design or copywriting.

The agents share your project context, while each specialist learns from your feedback in its own area.

### 2. Set the standard in the draft, then delegate

A feature can meet every requirement and still have an awkward UI. A video can be produced exactly as requested, yet have a stiff script that sounds AI-generated.

AI4Kanban identifies the parts of a task that need your judgment and brings in the right specialists to draft them. Agents then build from what you approved.

### 3. Break requests into tasks you can ship independently

Agents work on independent tasks in parallel, with separate Git worktrees for coding. Ship urgent tasks as they're ready.
`,
  },
};

const SHOT_NAMES = [
  "Research preview title",
  "Chat switches to Cowork",
  "Logo zooms in",
  "Title and task cards",
  "Typing in the input box",
  "Picking a folder",
  "Push in on Let's go",
  "Reply and follow-up cards",
  "Building plan",
  "Progress card",
  "The user adds a message",
  "Calendar check reply",
  "Calendar in the browser",
  "Context and artifacts",
  "Slide preview",
  "Reply: you cooked",
  "What will you try next",
  "Wordmark ending",
];
const SHOT_ENDS = [2.25, 5.5, 7, 11.5, 14.75, 16.46, 20, 28, 31, 35, 41.7, 45.63, 47.38, 53.5, 57.38, 62.17, 66, 68.6];

/** The two shots a preview pages between, written out; the rest only show in the timeline. */
const SCRIPT: Record<number, { action: string; captions: string[]; details: string }> = {
  4: {
    action:
      "An input box rises under the task cards and a request types out; the cursor moves to “Work in a folder” at its lower left and clicks.",
    captions: ["Summarize my meetings from this week and find action items.", "Work in a folder", "Let’s go"],
    details:
      "Motion: the box rises and fades in; typing at ~25 chars/s; cursor moves power2.inOut and springs on click. Props: arrow cursor. Slot: the product’s input box and its options. Transition: hard cut. Sound: keyboard.",
  },
  5: {
    action: "The screen dims, the system Open panel drops in, and a hand cursor picks a folder.",
    captions: ["Documents", "Projects", "Meeting Transcripts", "Cancel", "Open"],
    details:
      "Motion: 0.2s dim, the panel scales up from 0.96 and fades in; hand cursor clicks. Props: macOS Open panel. Slot: the picked folder’s name. Transition: hard cut back to the input box. Sound: click.",
  },
};

const board = { src: "", card: 0, ratio: 16 / 9, size: { width: 1920, height: 1080 }, diagnostics: [], report: "" };

export const STORYBOARD: StoryboardView = {
  ...board,
  src: ".assets/demo/breakdown.json",
  slides: null,
  shots: SHOT_NAMES.map((name, k) => ({
    id: `S${k + 1}`,
    start: k ? SHOT_ENDS[k - 1]! : 0,
    end: SHOT_ENDS[k]!,
    voiceover: { mode: "none" },
    action: SCRIPT[k]?.action ?? name,
    captions: SCRIPT[k]?.captions ?? [],
    details: SCRIPT[k]?.details ?? "",
    frames: [frame(`${DIR}/shots/s${k + 1}.jpg`, name)],
  })),
};

const SLIDES: [string, string, string?][] = [
  ["cover", "People review the key parts; agents do the rest"],
  ["split-detail", "You review your part; agents do the rest"],
  ["split-draft", "You review your part; agents do the rest"],
  ["draft-explained", "A draft holds only what you need to review"],
  ["split-confirm", "You review your part; agents do the rest"],
  ["boundary-agent", "You review your part; agents do the rest"],
  ["autopilot-gears", "We tried handing everything to agents"],
  [
    "autopilot-stuck",
    "The talk we skipped came back as rework",
    "At first we never settled what a person should review. We tried to get by on chat and memory, and only found out at the end that the work missed.",
  ],
  [
    "output-chart",
    "Daily output up 4×",
    "Our own overall throughput is about four times what plain vibe coding gave us. The chart shows one stretch: 15 a day on average in September, 39 a day in the five days after the switch, peaking above forty.",
  ],
  [
    "kept-interactions",
    "Our mission: find how people work well with agents",
    "Every interaction here came from our own use and experiments: what failed was dropped, what worked stayed, and it keeps improving as models do.",
  ],
  ["workflow-product", "What worked, as ready-made workflows"],
  ["review-scope", "A workflow first defines what you review"],
  ["two-ways", "Use a workflow as it is, or define your own"],
  ["practice-loop", "From our own practice to workflows anyone can use"],
  ["team", "The founding team"],
  ["next", "Starting from coding; next, content and games"],
  ["workbench", "One project, less explaining from scratch"],
  ["layers", "Stronger models need a clearer review scope"],
  ["closing", "People review the key parts; agents do the rest"],
];

export const DECK: StoryboardView = {
  ...board,
  src: ".assets/demo/deck.json",
  shots: null,
  slides: SLIDES.map(([id, title, notes]) => ({
    id,
    title,
    copy: [],
    notes,
    layout: "",
    assets: [],
    preview: frame(`${DIR}/slides/${id}.jpg`, title),
  })),
};

const PAGE_TITLES = [
  "Stop reading AI's walls of text",
  "AI gives you too much, and it's all text",
  "Run many tasks at once, and review is the bottleneck",
  "HTML is the new PRD",
  "Trust agents to read what the UI implies",
  "It works for more than UI",
  "Skip some details. Review every key part.",
  "Discuss → plan → draft, one workflow",
];

export const CAROUSEL: StoryboardView = {
  ...board,
  src: ".assets/demo/carousel.json",
  ratio: 3 / 4,
  size: { width: 1080, height: 1440 },
  shots: null,
  slides: PAGE_TITLES.map((title, k) => ({
    id: `p${k + 1}`,
    title,
    copy: [],
    layout: "",
    assets: [],
    preview: frame(`${DIR}/carousel/${k + 1}.jpg`, title),
  })),
};

/** The clips start at S5, so every shot is moved back by its start. */
const CLIP_START = SHOT_ENDS[3]!;

export const CLONE: { a: MockupView; b: MockupView; shots: Shot[] } = {
  a: { src: ".assets/demo/source.mp4", media: { kind: "video", href: `${DIR}/source.mp4` } },
  b: { src: ".assets/demo/clone.mp4", media: { kind: "video", href: `${DIR}/clone.mp4` } },
  shots: SHOT_NAMES.map((name, k) => ({
    id: `S${k + 1}`,
    start: (k ? SHOT_ENDS[k - 1]! : 0) - CLIP_START,
    end: SHOT_ENDS[k]! - CLIP_START,
    name,
  })),
};
