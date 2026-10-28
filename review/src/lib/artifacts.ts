// Turns the review's artifacts into what the copied preview components draw. A body's tag
// reaches its artifact through `card.assets`; a storyboard's frames and a compare's sides name
// artifact ids of the same review. Files are read with the sign-in and drawn from blob URLs.

import { ApiError, readFile, saveVersion, type Artifact, type ArtifactVersion, type Shared, type SharedComponent } from "../api";
import { API_URL } from "../config";
import { COPY, LANG } from "../i18n";
import { hyperframeDocument } from "./hyperframe-document";
import { schemaProblem } from "./schema";
import { parseShots, shotsProblem, storyboardShots, type Shot } from "./format/compare";
import type { CompareSpec, ComponentSpec, Drawn, MockupView } from "./mockup-tag";
import { imageSize, parseStoryboard, type StoryboardFrame, type StoryboardFrameView, type StoryboardView } from "./storyboard";

type Ref = { art: Artifact; version: ArtifactVersion };

const blobs = new Map<string, Promise<Blob>>();

/** A file's bytes, read once per address. A failure is not kept. */
function blobOf(file: NonNullable<ArtifactVersion["file"]>): Promise<Blob> {
  const url = file.url.startsWith("http") ? file.url : `${API_URL}${file.url}`;
  let got = blobs.get(url);
  if (!got) {
    got = readFile(url).catch((e: unknown) => {
      blobs.delete(url);
      throw e;
    });
    blobs.set(url, got);
  }
  return got;
}

const urls = new WeakMap<Blob, string>();
const urlOf = (blob: Blob) => {
  let url = urls.get(blob);
  if (!url) urls.set(blob, (url = URL.createObjectURL(blob)));
  return url;
};

const isHyperframe = (name: string) => name.endsWith(".hf.html");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The text a version holds: an inline field, or its file read as text. */
async function textOf(v: ArtifactVersion, field: string): Promise<string | null> {
  if (isObj(v.content) && typeof v.content[field] === "string") return v.content[field] as string;
  if (typeof v.content === "string") return v.content;
  return v.file ? (await blobOf(v.file)).text() : null;
}

/** What a component may do on this page: `saved` runs after a save landed; no `component` reader, no component. */
export type Host = {
  component: ((art: Artifact, v: ArtifactVersion) => Promise<SharedComponent>) | null;
  canSave: boolean;
  saved: () => void;
};

const SAVE_LIMIT = 256 * 1024;

export class Previews {
  private byId: Map<string, Artifact>;
  constructor(
    private shared: Shared,
    private host: Host,
  ) {
    this.byId = new Map(shared.artifacts.map((a) => [a.id, a]));
  }

  /** The version shown: the one `card.assets` pins, else the latest. */
  private ref(id: string, version?: number): Ref | null {
    const art = this.byId.get(id);
    const n = version ?? art?.latest_version;
    const v = art?.versions.find((x) => x.version === n);
    return art && v ? { art, version: v } : null;
  }

  /** The artifact a body path names, through `card.assets`. */
  refOfSrc(src: string): Ref | null {
    const at = this.shared.card?.assets[src];
    return at ? this.ref(at.artifact, at.version) : null;
  }

  /** The artifact ids the body reaches, so the rest can be listed after it. */
  referenced(srcs: string[]): Set<string> {
    const ids = new Set<string>();
    for (const src of srcs) {
      const at = this.shared.card?.assets[src];
      if (!at) continue;
      ids.add(at.artifact);
      const ref = this.ref(at.artifact, at.version);
      // A storyboard's frames and a compare's sides are drawn inside it.
      for (const id of ref ? innerIds(ref) : []) ids.add(id);
    }
    return ids;
  }

  unreferenced(srcs: string[]): Artifact[] {
    const used = this.referenced(srcs);
    const inner = new Set(this.shared.artifacts.flatMap((a) => (used.has(a.id) ? [] : innerIdsOf(this.ref(a.id)))));
    return this.shared.artifacts.filter((a) => !used.has(a.id) && !inner.has(a.id));
  }

  missing(src: string, label?: string): MockupView {
    return { src, error: COPY.card.mockup.missing(label || src.split("/").pop()!) };
  }

  // One view per path or id, so a re-render never starts a load again.
  private views = new Map<string, MockupView>();
  private once(key: string, make: () => MockupView): MockupView {
    let v = this.views.get(key);
    if (!v) this.views.set(key, (v = make()));
    return v;
  }

  /** What a body path draws as. */
  viewOfSrc(src: string, label?: string): MockupView {
    return this.once(`src:${src}`, () => {
      const ref = this.refOfSrc(src);
      return ref ? this.viewOf(ref, src) : this.missing(src, label);
    });
  }

  viewOfArtifact(id: string): MockupView {
    return this.once(`id:${id}`, () => {
      const ref = this.ref(id);
      return ref ? this.viewOf(ref, ref.art.name) : this.missing(id);
    });
  }

  private viewOf({ art, version: v }: Ref, src: string): MockupView {
    const failed = (): Drawn => ({ src, error: COPY.card.mockup.previewFailed });
    const guard = (load: () => Promise<Drawn>) => () => load().catch(failed);
    if (art.type.startsWith("@")) return { src, component: this.componentOf(art, v) };
    switch (art.type) {
      case "html": {
        const hyperframe = isHyperframe(src) || isHyperframe(art.name);
        return {
          src,
          deferred: {
            screen: !hyperframe,
            hyperframe,
            load: guard(async () => {
              const doc = await textOf(v, "html");
              if (doc === null) return failed();
              return hyperframe ? { src, doc: hyperframeDocument(doc), hyperframe } : { src, doc, scripts: true };
            }),
          },
        };
      }
      case "image":
      case "video":
        if (!v.file) return this.missing(src, art.name);
        return {
          src,
          deferred: {
            screen: false,
            load: guard(async () => {
              const href = urlOf(await blobOf(v.file!));
              if (art.type === "image") return { src, image: href };
              return { src, media: { kind: v.file!.content_type.startsWith("audio/") ? "audio" : "video", href } };
            }),
          },
        };
      case "markdown":
        return {
          src,
          deferred: {
            screen: false,
            load: guard(async () => {
              const text = await textOf(v, "markdown");
              if (text === null) return failed();
              return { src, article: { text, href: urlOf(new Blob([text], { type: "text/markdown" })) } };
            }),
          },
        };
      case "storyboard":
        return { src, storyboard: () => this.storyboard(v, src) };
      case "compare":
        return isObj(v.content) ? { src, compare: this.compareOf(v.content, src) } : this.missing(src, art.name);
      default:
        return { src, file: fileOf(art, v) };
    }
  }

  /** Framed when a component is pinned and still published; the file to download otherwise. */
  private componentOf(art: Artifact, v: ArtifactVersion): ComponentSpec {
    const pin = v.component;
    const { component, canSave, saved } = this.host;
    let schema: unknown = null;
    return {
      file: fileOf(art, v),
      load: async () => {
        if (!pin || !component) throw new Error("no component");
        const [meta, data] = await Promise.all([
          component(art, v),
          v.file ? blobOf(v.file).then((b) => b.arrayBuffer()) : null,
        ]);
        schema = meta.schema;
        const artifact = { type: art.type, name: art.name, version: v.version, ...(data ? { file: { data, contentType: v.file!.content_type } } : { content: v.content }) };
        return { url: meta.url, schema, context: { artifact, readOnly: !canSave, locale: LANG, theme: "light" } };
      },
      save: canSave
        ? async (content) => {
            const t = COPY.card.save;
            let text: string | undefined;
            try {
              text = JSON.stringify(content);
            } catch {
              /* unserializable: refused below */
            }
            if (text === undefined) throw new Error(t.invalid);
            if (new TextEncoder().encode(text).length > SAVE_LIMIT) throw new Error(t.tooLarge);
            if (schemaProblem(schema, JSON.parse(text))) throw new Error(t.invalid);
            try {
              const made = await saveVersion(art.id, JSON.parse(text));
              saved();
              return { version: made.version };
            } catch (e) {
              const code = e instanceof ApiError ? e.code : "";
              throw new Error(
                code === "conflict" ? t.closed
                : code === "owner_only" || code === "not_found" || code === "unauthenticated" ? t.refused
                : code === "payload_too_large" ? t.tooLarge
                : code === "bad_request" ? t.invalid
                : code === "offline" ? t.offline
                : t.failed,
              );
            }
          }
        : null,
    };
  }

  /** A loaded side of a compare: an image or a video, a storyboard, or the note. */
  private async side(id: string): Promise<Drawn | StoryboardView> {
    const ref = this.ref(id);
    if (!ref) return { src: id, error: COPY.card.mockup.missing(id) };
    const view = this.viewOf(ref, ref.art.name);
    if (view.storyboard) return view.storyboard();
    if (view.deferred) return view.deferred.load();
    return view;
  }

  private compareOf(c: Record<string, unknown>, src: string): CompareSpec {
    const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
    return this.compare({ a: s("a"), b: s("b"), shots: c.shots, label: s("label") || src, aLabel: s("a-label") || s("a_label") || s("aLabel"), bLabel: s("b-label") || s("b_label") || s("bLabel") }, (x) => x);
  }

  /** A `<Compare>` tag's sides, by body path. */
  compareOfTag(tag: { a: string; b: string; shots: string; label: string; aLabel: string; bLabel: string }): CompareSpec {
    return this.once(`cmp:${JSON.stringify(tag)}`, () => ({ src: tag.a, compare: this.compare(tag, (path) => this.shared.card?.assets[path]?.artifact ?? path) })).compare!;
  }

  private compare(
    t: { a: string; b: string; shots: unknown; label: string; aLabel: string; bLabel: string },
    idOf: (x: string) => string,
  ): CompareSpec {
    return {
      label: t.label,
      aLabel: t.aLabel,
      bLabel: t.bLabel,
      load: async () => {
        const [a, b] = await Promise.all([this.side(idOf(t.a)), this.side(idOf(t.b))]);
        const out: Awaited<ReturnType<CompareSpec["load"]>> = { a: "storyboard" in a ? { src: t.a, error: COPY.card.compare.mismatch } : a, b };
        if (Array.isArray(t.shots)) {
          if (!shotsProblem(t.shots)) out.shots = t.shots as Shot[];
        } else if (typeof t.shots === "string" && t.shots) {
          const ref = this.ref(idOf(t.shots));
          if (ref?.art.type === "storyboard") out.breakdown = await this.storyboard(ref.version, ref.art.name);
          else if (ref) {
            const list = Array.isArray(ref.version.content) ? (shotsProblem(ref.version.content) ? null : (ref.version.content as Shot[])) : parseShots((await textOf(ref.version, "shots")) ?? "");
            if (list) out.shots = list;
          }
        }
        if (!out.shots && !out.breakdown && "storyboard" in b && b.shots) out.shots = storyboardShots({ shots: b.shots });
        return out;
      },
    };
  }

  private async storyboard(v: ArtifactVersion, src: string): Promise<StoryboardView> {
    let data = v.content;
    if (data === null && v.file) data = JSON.parse(await (await blobOf(v.file)).text());
    const parsed = parseStoryboard(data);
    const frame = async (f: StoryboardFrame, slide = false): Promise<StoryboardFrameView> => {
      const ref = this.ref(f.src);
      const none: StoryboardFrameView = { src: f.src, alt: f.alt, href: null, ratio: null };
      if (!ref) return none;
      try {
        if (slide && ref.art.type === "html") {
          const doc = await textOf(ref.version, "html");
          return doc === null ? none : { src: f.src, alt: f.alt, href: ref.art.id, ratio: parsed!.size.width / parsed!.size.height, page: true, doc };
        }
        if (ref.art.type !== "image" || !ref.version.file) return none;
        const blob = await blobOf(ref.version.file);
        const size = imageSize(new Uint8Array(await blob.slice(0, 64 * 1024).arrayBuffer()));
        return { src: f.src, alt: f.alt, href: urlOf(blob), ratio: size && size.height > 0 ? size.width / size.height : null };
      } catch {
        return none;
      }
    };
    const shots = parsed?.shots ? await Promise.all(parsed.shots.map(async (s) => ({ ...s, frames: await Promise.all(s.frames.map((f) => frame(f))) }))) : null;
    const slides = parsed?.slides ? await Promise.all(parsed.slides.map(async (s) => ({ ...s, preview: await frame(s.preview, true) }))) : null;
    const first = [...(slides?.map((s) => s.preview) ?? []), ...(shots?.flatMap((s) => s.frames) ?? [])].find((f) => f.ratio);
    return { src, storyboard: true, ratio: first?.ratio ?? 16 / 9, size: parsed?.size ?? { width: 1920, height: 1080 }, shots, slides };
  }
}

/** The artifact ids a storyboard or compare version draws inside itself. */
function innerIds({ art, version }: Ref): string[] {
  const c = version.content;
  if (!isObj(c)) return [];
  if (art.type === "compare") return [c.a, c.b, c.shots].filter((x): x is string => typeof x === "string");
  if (art.type === "storyboard") {
    const frames = [...(Array.isArray(c.shots) ? c.shots : []).flatMap((s) => (isObj(s) && Array.isArray(s.frames) ? s.frames : [])), ...(Array.isArray(c.slides) ? c.slides : []).map((s) => (isObj(s) ? s.preview : null))];
    return frames.map((f) => (isObj(f) && typeof f.src === "string" ? f.src : "")).filter(Boolean);
  }
  return [];
}

const innerIdsOf = (ref: Ref | null) => (ref ? innerIds(ref) : []);

const EXTS: Record<string, string> = {
  "application/json": "json",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "application/zip": "zip",
};

/** The name with the extension its content type implies, unless it already ends in one. */
function withExt(name: string, contentType: string): string {
  const ext = EXTS[contentType.split(";")[0]!.trim().toLowerCase()];
  if (!ext) return name;
  const has = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const same = has === ext || (ext === "jpeg" && has === "jpg");
  return same ? name : `${name}.${ext}`;
}

/** A version as a download: its file, or its JSON. */
function fileOf(art: Artifact, v: ArtifactVersion) {
  return {
    name: withExt(art.name, v.file?.content_type ?? "application/json"),
    load: async () => {
      if (v.file) return urlOf(await blobOf(v.file));
      return urlOf(new Blob([JSON.stringify(v.content, null, 2)], { type: "application/json" }));
    },
  };
}
