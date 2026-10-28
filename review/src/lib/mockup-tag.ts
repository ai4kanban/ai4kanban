// Copied from legacy kanban-ui/lib/mockup-tag.ts. The tag a card body may carry (#803), and its
// older spelling (#239):
//
//   <Asset src=".assets/803/a.png" label="A" />
//   <Mockup src=".mockups/239/a.tsx" label="A" />
//
// Changed: `src` names no file here. The card's `assets` map points it at an artifact of the
// review, and a view loads that artifact's version when it scrolls near (lib/artifacts.ts).

import { compareTag, type Shot } from "./format/compare";
import { storyboardAttrs } from "./format/storyboard";
import type { BridgeContext } from "./bridge";
import type { StoryboardView } from "./storyboard";

/** A mockup as a card body points at it. */
export type MockupTag = {
  src: string;
  /** The name on the frame. Empty when the tag carries none. */
  label: string;
  alt: string;
  /** The screen an HTML mockup is laid out on (#1097). Anything but `mobile` is desktop. */
  device: Device;
  /** A bare `loop` (#1595): a video that plays muted, looping and without controls. */
  loop: boolean;
  variants: Variant[];
};

export type Variant = { label: string; src: string };

export type Device = "mobile" | "desktop";

/** The canvas each device's screen is laid out on, before it is scaled. */
export const SCREENS: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 393, h: 852 },
};

export const deviceOf = (value: string | null | undefined): Device => (value === "mobile" ? "mobile" : "desktop");

export type ArticleFile = { text: string; href: string };

/** What one artifact version draws as, once loaded. */
export type Drawn = {
  src: string;
  /** A whole HTML document, for the frame's iframe. */
  doc?: string;
  scripts?: boolean;
  /** A `.hf.html` composition, played rather than laid out on a device. */
  hyperframe?: boolean;
  image?: string;
  media?: { kind: "video" | "audio"; href: string };
  file?: { name: string; load: () => Promise<string> };
  article?: ArticleFile;
  /** The note in its place. */
  error?: string;
};

/** Two sides and how the play bar is cut, all of the same review (#1740, #1803). */
export type CompareSpec = {
  label: string;
  aLabel: string;
  bLabel: string;
  load: () => Promise<{ a: Drawn; b: Drawn | StoryboardView; shots?: Shot[]; breakdown?: StoryboardView }>;
};

/** A developer's component (#2006), framed on its own origin. `load` fails for any reason the
 *  frame cannot be drawn; `save` is there for those who may save. */
export type ComponentSpec = {
  load: () => Promise<{ url: string; schema: unknown; context: BridgeContext }>;
  save: ((content: unknown) => Promise<{ version: number }>) | null;
  file: { name: string; load: () => Promise<string> };
};

/** What the card page draws for one tag: a preview still to load, or the note saying why not. */
export type MockupView = Drawn & {
  component?: ComponentSpec;
  /** Loaded once it scrolls near (#906). `screen` marks an HTML page, laid out on a device. */
  deferred?: { load: () => Promise<Drawn>; screen: boolean; hyperframe?: boolean };
  storyboard?: () => Promise<StoryboardView>;
  compare?: CompareSpec;
};

// A self-closing tag with no `<` or `>` inside it.
const TAG = /<(?:Asset|Mockup)\b([^<>]*?)\/>/g;
const ATTR = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'/g;
const LOOP = /(?:^|\s)loop(?=\s|$)/;

/** Every mockup tag in a run of raw HTML, in the order they appear. */
export function mockupTags(raw: string): MockupTag[] {
  const found: MockupTag[] = [];
  for (const match of raw.matchAll(TAG)) {
    const attrs: Record<string, string> = {};
    for (const a of match[1]!.matchAll(ATTR)) {
      attrs[(a[1] ?? a[3])!] = (a[2] ?? a[4])!;
    }
    if (!attrs.src) continue;
    const loop = LOOP.test(match[1]!.replace(ATTR, ""));
    found.push({ src: attrs.src, label: attrs.label ?? "", alt: attrs.alt ?? "", device: deviceOf(attrs.device), loop, variants: variantsOf(attrs.variants, attrs.src) });
  }
  return found;
}

/** `variants` as written: two or more, `src` among them — anything else is no variants. */
export function variantsOf(raw: string | undefined, src: string): Variant[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const list = Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1]);
  if (list.length < 2 || !list.some(([, s]) => s === src)) return [];
  return list.map(([label, s]) => ({ label, src: s }));
}

/** The tags in a block that holds nothing but tags — `null` when anything else is in there. */
export function mockupBlock(raw: string): MockupTag[] | null {
  const tags = mockupTags(raw);
  if (tags.length === 0) return null;
  return raw.replace(TAG, "").trim() === "" ? tags : null;
}

const COMPARE = /<Compare\b[^<>]*?\/>/g;
const STORYBOARD = /<Storyboard\b[^<>]*?\/>/g;

/** Every path a body's tags name: variants, `<Compare>` sides and `<Storyboard>`s included. */
export function bodySources(body: string): string[] {
  const compared = [...body.matchAll(COMPARE)].flatMap((m) => {
    const tag = compareTag(m[0]);
    return tag ? [tag.a, tag.b, ...(tag.shots ? [tag.shots] : [])] : [];
  });
  const boards = [...body.matchAll(STORYBOARD)].flatMap((m) => storyboardAttrs(m[0])?.src ?? []);
  return [...new Set([...mockupTags(body).flatMap((t) => [t.src, ...t.variants.map((v) => v.src)]), ...compared, ...boards])];
}
