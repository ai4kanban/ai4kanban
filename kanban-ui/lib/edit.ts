import fs from "node:fs";
import path from "node:path";
import { CADENCE_FORMS, formatCadence, parseCadence } from "./cadence";
import { normalizeRelease, parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { readmePath, todoDir } from "./paths";
import { readReleases } from "./releases";
import { NO_RELEASE } from "./types";

const LEVELS = ["high", "med", "low"];

// Find a card file by id — a standalone `NN-slug.md` or a group `NN-slug/root.md`.
function locate(id: number): string | null {
  function walk(dir: string): string | null {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const m = entry.name.match(/^(\d+)-/);
        if (m && Number(m[1]) === id) {
          const root = path.join(full, "root.md");
          if (fs.existsSync(root)) return root;
        }
        const hit = walk(full);
        if (hit) return hit;
      } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
        const m = entry.name.match(/^(\d+)-/);
        if (m && Number(m[1]) === id) return full;
      }
    }
    return null;
  }
  return walk(todoDir());
}

// Write `release` down every card inside a group folder — each subtask, and the
// root and subtasks of a nested group, all the way down. Ported from
// setSubtreeRelease in skill/lib/releases.mjs, which explains why a group moves
// as one: the subtasks are the work, so a root promised to a version whose
// subtasks name nothing would leave that work out of it.
//
// Only cards move. README.md, a sibling doc, a file with no frontmatter — none
// of them carry a release. The group's own root is skipped: patchCard has just
// written it.
function setSubtreeRelease(dir: string, release: string): void {
  const root = path.join(dir, "root.md");
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name === "README.md" || full === root) continue;
      const { meta, body } = parseFrontmatter(fs.readFileSync(full, "utf8"));
      if (!meta) continue;
      meta.release = release;
      fs.writeFileSync(full, serializeFrontmatter(meta) + "\n" + body);
    }
  }
  walk(dir);
}

// Rewrite the title in the README index bullet for this id, keeping its link.
function syncReadmeTitle(id: number, title: string): void {
  const rp = readmePath();
  if (!fs.existsSync(rp)) return;
  const src = fs.readFileSync(rp, "utf8");
  const re = new RegExp(`(\\-\\s*\\[#${id}\\s+)([^\\]]*)(\\]\\()`);
  if (!re.test(src)) return;
  fs.writeFileSync(rp, src.replace(re, `$1${title}$3`));
}

export interface CardPatch {
  title?: string;
  body?: string;
  priority?: string;
  roi?: string;
  /** A version id from `releases.md`, or empty to take the card out of a
   *  release. Nothing else is accepted — see patchCard. */
  release?: string;
  /** How often a recurring card repeats (#139) — one of lib/cadence.ts's forms,
   *  or empty to take the cadence off and leave the card running only when
   *  someone clicks Run. Recurring cards only. */
  cadence?: string;
}

export interface PatchResult {
  ok: boolean;
  error?: string;
}

// Apply a direct edit to a card file. Only the validated fields of CardPatch are
// writable here — everything else (track, id, links, questions) stays with the
// agents and the script. Frontmatter is re-serialized with the script's exact
// formatter so the diff is minimal and the script can still read the card.
export function patchCard(id: number, patch: CardPatch): PatchResult {
  if (!Number.isInteger(id)) return { ok: false, error: "bad id" };
  const file = locate(id);
  if (!file) return { ok: false, error: `no open card #${id}` };

  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  if (!meta) return { ok: false, error: `card #${id} has no frontmatter` };

  let titleChanged = false;
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "title must not be empty" };
    if (t !== meta.title) titleChanged = true;
    meta.title = t;
  }
  if (patch.priority !== undefined) {
    if (!LEVELS.includes(patch.priority))
      return { ok: false, error: `priority must be one of ${LEVELS.join(" | ")}` };
    meta.priority = patch.priority;
  }
  if (patch.roi !== undefined) {
    if (!LEVELS.includes(patch.roi))
      return { ok: false, error: `roi must be one of ${LEVELS.join(" | ")}` };
    meta.roi = patch.roi;
  }
  // A card can only be moved onto a release that exists, the same check the
  // script makes — a typo must not quietly invent a version. An empty value is
  // always allowed: it means no release, so writing it is how a card comes back
  // out of a release. The card's OWN release
  // isn't accepted just because the card names it: `releases.md` is a file a
  // person edits, and a card left pointing at a line someone deleted still shows
  // what it says but can only move onto a release that is really there.
  if (patch.release !== undefined) {
    const release = normalizeRelease(patch.release);
    const known = readReleases();
    if (release !== NO_RELEASE && !known.includes(release)) {
      return {
        ok: false,
        error:
          `unknown release "${release}" — releases on the list: ` +
          `${known.join(", ") || "(none)"}. Make one with \`release new <id>\`.`,
      };
    }
    meta.release = release;
  }
  // The cadence, written the same way the script writes it (#139): only a card
  // that repeats can carry one, and only in a form the scheduler can read — a
  // half-parsed line would look like a schedule and never run. Empty clears it,
  // which is how a card goes back to running only when someone clicks Run.
  if (patch.cadence !== undefined) {
    if (path.relative(todoDir(), file).split(path.sep)[0] !== "recurring") {
      return { ok: false, error: `#${id} is not a recurring card — only a card that repeats can have a cadence` };
    }
    const text = patch.cadence.trim();
    const parsed = text ? parseCadence(text) : null;
    if (text && !parsed) return { ok: false, error: `"${text}" isn't a cadence. Accepted: ${CADENCE_FORMS}` };
    meta.cadence = parsed ? formatCadence(parsed) : "";
  }

  const newBody = patch.body !== undefined ? patch.body : body;
  const normalizedBody = newBody.replace(/^\n+/, "").replace(/\s+$/, "");
  fs.writeFileSync(file, serializeFrontmatter(meta) + "\n\n" + normalizedBody + "\n");

  // A group root's release is the whole group's: putting the root in a version
  // puts every subtask in it, and taking the root out takes them all out.
  if (patch.release !== undefined && path.basename(file) === "root.md") {
    setSubtreeRelease(path.dirname(file), meta.release);
  }

  if (titleChanged) syncReadmeTitle(id, meta.title);
  return { ok: true };
}
