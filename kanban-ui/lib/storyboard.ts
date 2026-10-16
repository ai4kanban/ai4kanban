// Read the storyboards a card body points at (#963), checked by lib/storyboard-check.ts.
// Frames are served by app/asset-image, a slide's HTML/TSX page by app/asset-view; only files
// that pass here get an address.

import fs from "node:fs";
import path from "node:path";
import { assetImageHref, mockupViewHref } from "./mockup-tag";
import { assetsDir } from "./cli";
import { repoRoot } from "./paths";
import { assetName, storyboardMarkers } from "./format/storyboard";
import {
  checkStoryboard,
  DEFAULT_SIZE,
  formatDiagnostics,
  FRAME_TYPES,
  frameProblem,
  imageSize,
  isPage,
  PAGE_TYPES,
  storyboardOwner,
  type StoryboardDiagnostic,
  type StoryboardFrame,
  type StoryboardShot,
  type StoryboardSize,
  type StoryboardSlide,
} from "./storyboard-check";

/** `ratio` is the picture's width ÷ height, `null` when it could not be read. `page` marks an
 *  HTML/TSX page, whose `href` is the `/asset-view` address it is drawn from. */
export type StoryboardFrameView = { src: string; alt: string; href: string | null; ratio: number | null; page?: true };
export type StoryboardShotView = Omit<StoryboardShot, "frames"> & { frames: StoryboardFrameView[] };
export type StoryboardSlideView = Omit<StoryboardSlide, "preview"> & { preview: StoryboardFrameView };

/** A script to draw: a video's shots or a deck's slides (#969), both null when the file could
 *  not be read as either. `report` is what Copy hands back to the session that wrote the
 *  file; empty when nothing is wrong. */
export type StoryboardView = {
  src: string;
  card: number;
  /** The page shape a missing picture is drawn in: the first readable picture's, else 16:9. */
  ratio: number;
  /** The canvas a page is laid out on before it is scaled. */
  size: StoryboardSize;
  shots: StoryboardShotView[] | null;
  slides: StoryboardSlideView[] | null;
  diagnostics: StoryboardDiagnostic[];
  report: string;
};

/** Every storyboard a body points at, keyed by `src` as the tag wrote it. */
export type StoryboardSet = Record<string, StoryboardView>;

/** A file inside `dir`, symlinks resolved — `null` when absent or when it leads out. */
function inside(dir: string, name: string): string | null {
  try {
    const root = fs.realpathSync(dir);
    const real = fs.realpathSync(path.join(dir, name));
    return real.startsWith(root + path.sep) && fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

/** `lead` is the agent the fix goes back to; empty leaves it to the file's shape. */
export async function readStoryboards(body: string, cardId: number, lead = ""): Promise<StoryboardSet> {
  const set: StoryboardSet = {};
  const markers = storyboardMarkers(body);
  if (!markers.length) return set;
  let dir: string;
  try {
    dir = path.join(await assetsDir(), String(cardId));
  } catch {
    dir = "";
  }
  const shown = (file: string) => path.relative(repoRoot(), file) || file;
  for (const { src } of markers) {
    if (set[src]) continue;
    const named = assetName(src, cardId, ["json"]);
    if (!("name" in named)) {
      const diagnostics = [{ file: src, code: "storyboard-src", pointer: "", ...named }];
      set[src] = { src, card: cardId, ratio: 16 / 9, size: DEFAULT_SIZE, shots: null, slides: null, diagnostics, report: formatDiagnostics(src, lead || "scriptwriter", diagnostics) };
      continue;
    }
    const json = dir ? inside(dir, named.name) : null;
    const file = dir ? shown(path.join(dir, named.name)) : src;
    // Frames that pass, by name, with the address the page loads them from and their shape.
    const drawn = new Map<string, { href: string; ratio: number | null }>();
    const source = json ? fs.readFileSync(json, "utf8") : null;
    const { storyboard, diagnostics } = checkStoryboard(source, {
      file,
      cardId,
      read: (name) => {
        const frame = inside(dir, name);
        if (isPage(name)) {
          if (frame) drawn.set(name, { href: mockupViewHref(`.assets/${cardId}/${name}`, Math.floor(fs.statSync(frame).mtimeMs)), ratio: null });
          return frame ? new Uint8Array() : null;
        }
        const bytes = frame ? fs.readFileSync(frame) : null;
        if (frame && bytes && !frameProblem(bytes)) {
          const size = imageSize(bytes);
          drawn.set(name, {
            href: `${assetImageHref(String(cardId), name)}?v=${Math.floor(fs.statSync(frame).mtimeMs)}`,
            ratio: size && size.height > 0 ? size.width / size.height : null,
          });
        }
        return bytes;
      },
    });
    // A page, found or not, takes the canvas's shape.
    const size = storyboard?.size ?? DEFAULT_SIZE;
    const frame = ({ src: frameSrc, alt }: StoryboardFrame, slide = false): StoryboardFrameView => {
      const at = assetName(frameSrc, cardId, slide ? [...FRAME_TYPES, ...PAGE_TYPES] : FRAME_TYPES, slide);
      const found = "name" in at ? drawn.get(at.name) : undefined;
      if ("name" in at && isPage(at.name)) return { src: frameSrc, alt, href: found?.href ?? null, ratio: size.width / size.height, page: true };
      return { src: frameSrc, alt, href: found?.href ?? null, ratio: found?.ratio ?? null };
    };
    const shots = storyboard && "shots" in storyboard ? storyboard.shots.map((shot) => ({ ...shot, frames: shot.frames.map((f) => frame(f)) })) : null;
    const slides =
      storyboard && "slides" in storyboard ? storyboard.slides.map((slide) => ({ ...slide, preview: frame(slide.preview, true) })) : null;
    const first = [...(slides?.map((s) => s.preview) ?? []), ...(shots?.flatMap((s) => s.frames) ?? [])].find((f) => f.ratio);
    set[src] = {
      src,
      card: cardId,
      ratio: first?.ratio ?? 16 / 9,
      size,
      shots,
      slides,
      diagnostics,
      report: diagnostics.length ? formatDiagnostics(file, lead || storyboardOwner(source), diagnostics) : "",
    };
  }
  return set;
}
