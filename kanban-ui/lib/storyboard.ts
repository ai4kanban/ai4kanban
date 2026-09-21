// Read the storyboards a card body points at (#963), checked with the same rules as
// `akb raw validate` (lib/format/storyboard.ts). Frames are served by app/asset-image; only
// files that pass here get an address.

import fs from "node:fs";
import path from "node:path";
import { assetImageHref } from "./mockup-tag";
import { assetsDir } from "./cli";
import { repoRoot } from "./paths";
import {
  assetName,
  checkStoryboard,
  formatDiagnostics,
  FRAME_TYPES,
  frameProblem,
  storyboardMarkers,
  type StoryboardDiagnostic,
  type StoryboardShot,
} from "./format/storyboard";

export type StoryboardFrameView = { src: string; alt: string; href: string | null };
export type StoryboardShotView = Omit<StoryboardShot, "frames"> & { frames: StoryboardFrameView[] };

/** A script to draw — `shots` null when the file could not be read as one. `report` is what
 *  Copy hands back to the session that wrote the file; empty when nothing is wrong. */
export type StoryboardView = {
  src: string;
  shots: StoryboardShotView[] | null;
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

export async function readStoryboards(body: string, cardId: number): Promise<StoryboardSet> {
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
      set[src] = { src, shots: null, diagnostics, report: formatDiagnostics(src, cardId, diagnostics) };
      continue;
    }
    const json = dir ? inside(dir, named.name) : null;
    const file = dir ? shown(path.join(dir, named.name)) : src;
    // Frames that pass, by name, with the address the page loads them from.
    const drawn = new Map<string, string>();
    const { storyboard, diagnostics } = checkStoryboard(json ? fs.readFileSync(json, "utf8") : null, {
      file,
      cardId,
      read: (name) => {
        const frame = inside(dir, name);
        const bytes = frame ? fs.readFileSync(frame) : null;
        if (frame && bytes && !frameProblem(bytes)) {
          drawn.set(name, `${assetImageHref(String(cardId), name)}?v=${Math.floor(fs.statSync(frame).mtimeMs)}`);
        }
        return bytes;
      },
    });
    const shots = storyboard?.shots.map((shot) => ({
      ...shot,
      frames: shot.frames.map(({ src: frameSrc, alt }) => {
        const at = assetName(frameSrc, cardId, FRAME_TYPES);
        return { src: frameSrc, alt, href: ("name" in at && drawn.get(at.name)) || null };
      }),
    }));
    set[src] = {
      src,
      shots: shots ?? null,
      diagnostics,
      report: diagnostics.length ? formatDiagnostics(file, cardId, diagnostics) : "",
    };
  }
  return set;
}
