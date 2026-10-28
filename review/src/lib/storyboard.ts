// Copied from legacy kanban-ui/lib/storyboard.ts and storyboard-check.ts: the shapes and the
// image size reader. Changed: a frame's `src` is an artifact of the same review, read by
// lib/artifacts.ts; a file that is neither shots nor slides draws one note instead of the
// diagnostics, which only its writer can act on.

export type Voiceover = { mode: "none" } | { mode: "spoken"; text: string; source: string };
export interface StoryboardFrame {
  src: string;
  alt: string;
}
export interface StoryboardShot {
  id: string;
  start: number;
  end: number;
  voiceover: Voiceover;
  action: string;
  captions: string[];
  details: string;
  frames: StoryboardFrame[];
}
export interface StoryboardSlide {
  id: string;
  title: string;
  copy: string[];
  notes?: string;
  layout: string;
  assets: string[];
  preview: StoryboardFrame;
}
export type StoryboardSize = { width: number; height: number };

/** The canvas a page is laid out on when the storyboard sets no `size`. */
export const DEFAULT_SIZE = { width: 1920, height: 1080 };

/** `ratio` is the picture's width ÷ height, `null` when it could not be read. `page` marks an
 *  HTML page, drawn from `doc`. */
export type StoryboardFrameView = { src: string; alt: string; href: string | null; ratio: number | null; page?: true; doc?: string };
export type StoryboardShotView = Omit<StoryboardShot, "frames"> & { frames: StoryboardFrameView[] };
export type StoryboardSlideView = Omit<StoryboardSlide, "preview"> & { preview: StoryboardFrameView };

export type StoryboardView = {
  src: string;
  storyboard: true;
  /** The page shape a missing picture is drawn in: the first readable picture's, else 16:9. */
  ratio: number;
  size: StoryboardSize;
  shots: StoryboardShotView[] | null;
  slides: StoryboardSlideView[] | null;
};

/** Size in pixels read from a PNG, GIF, JPEG or WebP header — `null` when it is none of them. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16be = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const u16le = (i: number) => b[i]! | (b[i + 1]! << 8);
  const u32be = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === "PNG") return { width: u32be(16), height: u32be(20) };
  if (b.length >= 10 && ascii(0, 4) === "GIF8") return { width: u16le(6), height: u16le(8) };
  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") return { width: 1 + (((b[22]! & 0x3f) << 8) | b[21]!), height: 1 + (((b[24]! & 0xf) << 10) | (b[23]! << 2) | (b[22]! >> 6)) };
    if (chunk === "VP8X") return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: u16be(i + 7), height: u16be(i + 5) };
      i += 2 + u16be(i + 2);
    }
  }
  return null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const frameOf = (v: unknown): StoryboardFrame => ({ src: str(isObj(v) ? v.src : ""), alt: str(isObj(v) ? v.alt : "") });

/** The shots or slides a storyboard's JSON holds, loosely read — `null` when it is neither. */
export function parseStoryboard(data: unknown): { size: StoryboardSize; shots?: StoryboardShot[]; slides?: StoryboardSlide[] } | null {
  if (!isObj(data)) return null;
  const s = isObj(data.size) && Number(data.size.width) > 0 && Number(data.size.height) > 0 ? { width: Number(data.size.width), height: Number(data.size.height) } : DEFAULT_SIZE;
  if (Array.isArray(data.shots)) {
    const shots = data.shots.filter(isObj).map(
      (x): StoryboardShot => ({
        id: str(x.id),
        start: Number(x.start) || 0,
        end: Number(x.end) || 0,
        voiceover: isObj(x.voiceover) && x.voiceover.mode === "spoken" ? { mode: "spoken", text: str(x.voiceover.text), source: str(x.voiceover.source) } : { mode: "none" },
        action: str(x.action),
        captions: Array.isArray(x.captions) ? x.captions.map(str) : [],
        details: str(x.details),
        frames: Array.isArray(x.frames) ? x.frames.map(frameOf) : [],
      }),
    );
    return { size: s, shots };
  }
  if (Array.isArray(data.slides)) {
    const slides = data.slides.filter(isObj).map(
      (x): StoryboardSlide => ({
        id: str(x.id),
        title: str(x.title),
        copy: Array.isArray(x.copy) ? x.copy.map(str) : [],
        notes: str(x.notes) || undefined,
        layout: str(x.layout),
        assets: Array.isArray(x.assets) ? x.assets.map(str) : [],
        preview: frameOf(x.preview),
      }),
    );
    return { size: s, slides };
  }
  return null;
}
