// Asset 与旧 Mockup 标签共用卡片资源清单和延迟加载视图。

import { type Shot } from "./format/compare";
import type { Context as BridgeContext } from "../index";
import type { StoryboardView } from "./storyboard";
import type { SpriteSheet } from "./format/spritesheet";

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

/** A Tiled map (#480) and every file it names, keyed as written there. `problem`: why it is not drawn. */
export type TiledMapFiles = {
  map: string;
  tilesets: Record<string, string>;
  images: Record<string, Blob>;
  problem?: "missing" | "zstd";
};

export type TiledSpec = { file: { name: string; load: () => Promise<string> }; load: () => Promise<TiledMapFiles> };

/** A sprite animation (#481): its frames and sheet image. `problem`: why it does not play. */
export type SpriteFiles = { sheet: SpriteSheet | null; image: Blob | null; name: string; problem?: "missing" | "remote" | "invalid" };

export type SpriteSpec = { file: { name: string; load: () => Promise<string> }; load: () => Promise<SpriteFiles> };

/** What the card page draws for one tag: a preview still to load, or the note saying why not. */
export type MockupView = Drawn & {
  component?: ComponentSpec;
  /** Loaded once it scrolls near (#906). `screen` marks an HTML page, laid out on a device. */
  deferred?: { load: () => Promise<Drawn>; screen: boolean; hyperframe?: boolean };
  storyboard?: () => Promise<StoryboardView>;
  /** A workflow diagram's data (#451), checked by the component drawing it. */
  workflow?: () => Promise<unknown>;
  compare?: CompareSpec;
  tiled?: TiledSpec;
  sprite?: SpriteSpec;
  /** Its artifact is still being read. */
  loading?: true;
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


/** Every path a body's tags name: variants, `<Compare>` sides and `<Storyboard>`s included. */
export { bodySources } from "./references";
