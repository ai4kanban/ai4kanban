import type { Context } from '../index';
import { manifestOf, mapReferences, referencesOf, type Manifest } from './manifest';
import { hyperframeDocument } from './hyperframe-document';
import { schemaProblem } from './schema';
import { parseShots, shotsProblem, storyboardShots, type Shot } from './format/compare';
import type { CompareSpec, ComponentSpec, Drawn, MockupView, SpriteFiles, TiledMapFiles } from './mockup-tag';
import { parseSpriteSheet } from './format/spritesheet';
import { imageSize, parseStoryboard, type StoryboardFrame, type StoryboardFrameView, type StoryboardView } from './storyboard';

export type ArtifactVersion = { version: number; content: unknown; file: { url: string; content_type: string } | null; component?: { name: string; version: string } | null };
export type Artifact = { id: string; type: string; name: string; latest_version: number | null; versions: ArtifactVersion[] };
export type SharedComponent = { schema: unknown; url: string; references?: Manifest['references'] };
export type Shared = { artifacts: Artifact[]; card: { assets: Record<string, { artifact: string; version?: number; error?: string }> } | null };
export type Services = {
  readFile: (url: string) => Promise<Blob>;
  saveVersion: (id: string, content: unknown) => Promise<{ version: number }>;
  errorCode: (error: unknown) => string;
  locale: Context['locale'];
  copy: { card: { mockup: { missing: (name: string) => string; undrawn: (name: string, why: string) => string; previewFailed: string }; compare: { mismatch: string }; save: Record<'invalid' | 'tooLarge' | 'closed' | 'refused' | 'offline' | 'failed', string> } };
};

type Ref = { art: Artifact; version: ArtifactVersion };

const urls = new WeakMap<Blob, string>();
const urlOf = (blob: Blob) => {
  let url = urls.get(blob);
  if (!url) urls.set(blob, (url = URL.createObjectURL(blob)));
  return url;
};

const isHyperframe = (name: string) => name.endsWith(".hf.html");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** What a component may do on this page: `saved` runs after a save landed; no `component` reader, no component. */
export type Host = {
  component: ((art: Artifact, v: ArtifactVersion) => Promise<SharedComponent>) | null;
  canSave: boolean;
  saved: () => void;
  /** An artifact not yet in hand: still being read, or its read failed. */
  status?: (id: string) => "loading" | "failed" | undefined;
};

const SAVE_LIMIT = 256 * 1024;

export class Previews {
  private byId: Map<string, Artifact>;
  constructor(
    private shared: Shared,
    private host: Host,
    private services: Services,
  ) {
    this.byId = new Map(shared.artifacts.map((a) => [a.id, a]));
  }

  private blobs = new Map<string, Promise<Blob>>();
  private blobOf = (file: NonNullable<ArtifactVersion['file']>): Promise<Blob> => {
    let value = this.blobs.get(file.url);
    if (!value) {
      value = this.services.readFile(file.url).catch(error => { this.blobs.delete(file.url); throw error; });
      this.blobs.set(file.url, value);
    }
    return value;
  };
  private async contextOf(art: Artifact, v: ArtifactVersion): Promise<Context> {
    const file = v.file ? { data: await (await this.blobOf(v.file)).arrayBuffer(), contentType: v.file.content_type } : undefined;
    return { artifact: { type: art.type, name: art.name, version: v.version, ...(file ? { file } : { content: v.content }) }, readOnly: !this.host.canSave, locale: this.services.locale, theme: 'light' };
  }

  private resource(art: Artifact, v: ArtifactVersion) {
    let context: Promise<Context> | undefined;
    const read = () => context ??= this.contextOf(art, v);
    return {
      context: read,
      text: async (field: string) => {
        const { artifact } = await read();
        if (isObj(artifact.content) && typeof artifact.content[field] === 'string') return artifact.content[field] as string;
        if (typeof artifact.content === 'string') return artifact.content;
        return artifact.file ? new TextDecoder().decode(artifact.file.data) : null;
      },
      json: async () => {
        const { artifact } = await read();
        if (artifact.file) return JSON.parse(new TextDecoder().decode(artifact.file.data)) as unknown;
        return typeof artifact.content === 'string' ? JSON.parse(artifact.content) as unknown : artifact.content;
      },
      blob: async () => {
        const { artifact } = await read();
        if (!artifact.file) return new Blob([JSON.stringify(artifact.content, null, 2)], { type: 'application/json' });
        return new Blob([artifact.file.data], { type: artifact.file.contentType });
      },
    };
  }
  private textOf(v: ArtifactVersion, field: string) {
    const art = [...this.byId.values()].find(a => a.versions.includes(v))!;
    return this.resource(art, v).text(field);
  }
  private fileOf(art: Artifact, v: ArtifactVersion) {
    return { name: withExt(art.name, v.file?.content_type ?? 'application/json'), load: async () => urlOf(await this.resource(art, v).blob()) };
  }

  private relative(src: string, owner: string): string {
    if (this.shared.card?.assets[src] || this.byId.has(src) || /^[a-z][\w+.-]*:/i.test(src)) return src;
    const parts = owner.split('/').slice(0, -1);
    for (const part of src.split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  }

  /** The version shown: the one `card.assets` pins, else the latest. */
  private ref(id: string, version?: number): Ref | null {
    const assets = this.shared.card?.assets ?? {};
    const pin = assets[id] ?? Object.values(assets).find(ref => ref.artifact === id);
    const art = this.byId.get(pin?.artifact ?? id);
    const n = version ?? pin?.version ?? art?.latest_version;
    const v = art?.versions.find((x) => x.version === n);
    return art && v ? { art, version: v } : null;
  }

  /** The artifact a body path names, through `card.assets`. */
  refOfSrc(src: string): Ref | null {
    const at = this.shared.card?.assets[src];
    return at ? this.ref(at.artifact, at.version) : this.ref(src);
  }

  /** The artifact ids the body reaches, so the rest can be listed after it. */
  referenced(srcs: string[]): Set<string> {
    const ids = new Set<string>();
    const visit = (src: string) => {
      const ref = this.refOfSrc(src);
      if (!ref || ids.has(ref.art.id)) return;
      ids.add(ref.art.id);
      for (const child of innerIds(ref)) visit(this.relative(child, ref.art.name));
    };
    for (const src of srcs) visit(src);
    // 文件形式的分镜无需额外读取就能从同步清单识别其依赖。
    for (const pin of Object.values(this.shared.card?.assets ?? {})) ids.add(pin.artifact);
    return ids;
  }

  unreferenced(srcs: string[]): Artifact[] {
    const used = this.referenced(srcs);
    const inner = new Set(this.shared.artifacts.flatMap((a) => (used.has(a.id) ? [] : innerIdsOf(this.ref(a.id)))));
    return this.shared.artifacts.filter((a) => !used.has(a.id) && !inner.has(a.id));
  }

  missing(src: string, label?: string): MockupView {
    return { src, error: this.services.copy.card.mockup.missing(label || src.split("/").pop()!) };
  }

  private absent(id: string | undefined, src: string, label?: string): MockupView {
    const status = id ? this.host.status?.(id) : undefined;
    if (status === "loading") return { src, loading: true };
    if (status === "failed") return { src, error: this.services.copy.card.mockup.previewFailed };
    return this.missing(src, label);
  }

  // One view per path or id, so a re-render never starts a load again.
  private views = new Map<string, MockupView>();
  private once(key: string, make: () => MockupView): MockupView {
    let v = this.views.get(key);
    if (!v) this.views.set(key, (v = make()));
    return v;
  }

  /** What a body path draws as; `as` is the type its tag declares. */
  viewOfSrc(src: string, label?: string, as?: "workflow"): MockupView {
    return this.once(`src:${src}:${as ?? ""}`, () => {
      const why = this.shared.card?.assets[src]?.error;
      if (why) return { src, error: this.services.copy.card.mockup.undrawn(label || src.split("/").pop()!, why) };
      const ref = this.refOfSrc(src);
      if (!ref) return this.absent(this.shared.card?.assets[src]?.artifact, src, label);
      // Runner 0.6.28 stored a workflow diagram as a plain file (#484).
      return this.viewOf(as && ref.art.type === "asset" ? { ...ref, art: { ...ref.art, type: as } } : ref, src);
    });
  }

  viewOfArtifact(id: string): MockupView {
    return this.once(`id:${id}`, () => {
      const ref = this.ref(id);
      return ref ? this.viewOf(ref, ref.art.name) : this.absent(id, id);
    });
  }

  private viewOf({ art, version: v }: Ref, src: string): MockupView {
    const failed = (): Drawn => ({ src, error: this.services.copy.card.mockup.previewFailed });
    const guard = (load: () => Promise<Drawn>) => () => load().catch(failed);
    if (art.type.startsWith("@")) return { src, component: this.componentOf(art, v) };
    const resource = this.resource(art, v);
    switch (art.type) {
      case "html": {
        const hyperframe = isHyperframe(src) || isHyperframe(art.name);
        return {
          src,
          deferred: {
            screen: !hyperframe,
            hyperframe,
            load: guard(async () => {
              const text = await resource.text("html");
              if (text === null) return failed();
              const doc = await this.withFiles(text, art);
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
              const href = urlOf(await resource.blob());
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
              const text = await resource.text("markdown");
              if (text === null) return failed();
              return { src, article: { text: await this.withImages(text, art), href: urlOf(new Blob([text], { type: "text/markdown" })) } };
            }),
          },
        };
      case "storyboard":
        return { src, storyboard: () => this.storyboard(v, src) };
      case "workflow":
        return { src, workflow: () => resource.json() };
      case "tiled":
        // A tileset on its own is a file, not a map.
        if (/\.ts[xj]$/i.test(art.name)) return { src, file: this.fileOf(art, v) };
        return { src, tiled: { file: this.fileOf(art, v), load: () => this.tiled(art, v) } };
      case "spritesheet":
        return { src, sprite: { file: this.fileOf(art, v), load: () => this.sprite(art, v) } };
      case "compare":
        return { src, compare: { label: src, aLabel: '', bLabel: '', load: async () => {
          const data = await resource.json();
          if (!isObj(data)) throw new Error(this.services.copy.card.mockup.previewFailed);
          return this.compareOf(data, src).load();
        } } };
      default:
        return { src, file: this.fileOf(art, v) };
    }
  }

  /** Framed when a component is pinned and still published; the file to download otherwise. */
  private componentOf(art: Artifact, v: ArtifactVersion): ComponentSpec {
    const pin = v.component;
    const { component, canSave, saved } = this.host;
    let schema: unknown = null;
    return {
      file: this.fileOf(art, v),
      load: async () => {
        if (!pin || !component) throw new Error("no component");
        const [meta, context] = await Promise.all([component(art, v), this.resource(art, v).context()]);
        schema = meta.schema;
        const files = this.filesOf({ name: art.name, types: [art.type], references: meta.references }, context.artifact.content, art.name);
        return { url: meta.url, schema, context: files.size ? { ...context, files: await this.contents(files) } : context };
      },
      save: canSave
        ? async (content) => {
            const t = this.services.copy.card.save;
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
              const made = await this.services.saveVersion(art.id, JSON.parse(text));
              saved();
              return { version: made.version };
            } catch (e) {
              const code = this.services.errorCode(e);
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
    if (!ref) return { src: id, error: this.services.copy.card.mockup.missing(id) };
    const view = this.viewOf(ref, ref.art.name);
    if (view.storyboard) return view.storyboard();
    if (view.deferred) return view.deferred.load();
    return view;
  }

  private compareOf(c: Record<string, unknown>, src: string): CompareSpec {
    const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
    return this.compare({ a: s("a"), b: s("b"), shots: c.shots, label: s("label") || src, aLabel: s("a-label") || s("a_label") || s("aLabel"), bLabel: s("b-label") || s("b_label") || s("bLabel") }, (x) => this.relative(x, src));
  }

  /** A `<Compare>` tag's sides, by body path. */
  compareOfTag(tag: { a: string; b: string; shots: string; label: string; aLabel: string; bLabel: string }): CompareSpec {
    return this.once(`cmp:${JSON.stringify(tag)}`, () => ({ src: tag.a, compare: this.compare(tag, path => path) })).compare!;
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
        const out: Awaited<ReturnType<CompareSpec["load"]>> = { a: "storyboard" in a ? { src: t.a, error: this.services.copy.card.compare.mismatch } : a, b };
        if (Array.isArray(t.shots)) {
          if (!shotsProblem(t.shots)) out.shots = t.shots as Shot[];
        } else if (typeof t.shots === "string" && t.shots) {
          const ref = this.ref(idOf(t.shots));
          if (ref?.art.type === "storyboard") out.breakdown = await this.storyboard(ref.version, ref.art.name);
          else if (ref) {
            const list = Array.isArray(ref.version.content) ? (shotsProblem(ref.version.content) ? null : (ref.version.content as Shot[])) : parseShots((await this.textOf(ref.version, "shots")) ?? "");
            if (list) out.shots = list;
          }
        }
        if (!out.shots && !out.breakdown && "storyboard" in b && b.shots) out.shots = storyboardShots({ shots: b.shots });
        return out;
      },
    };
  }

  /** A map's text and the tilesets and images it reaches, each named as written where it is used. */
  private async tiled(art: Artifact, v: ArtifactVersion): Promise<TiledMapFiles> {
    const out: TiledMapFiles = { map: (await this.resource(art, v).text("tiled")) ?? "", tilesets: {}, images: {} };
    const zstd = (text: string) => /compression\s*=\s*["']zstd|"compression"\s*:\s*"zstd"/.test(text);
    const read = async (text: string, owner: string): Promise<void> => {
      await Promise.all(referencesOf(manifestOf("tiled"), text).map(async ({ src, types }) => {
        const ref = this.ref(this.relative(src, owner));
        if (!ref?.version.file) { out.problem ??= "missing"; return; }
        const blob = await this.blobOf(ref.version.file);
        if (!types.length) { out.images[src] = blob; return; }
        const tileset = await blob.text();
        out.tilesets[src] = tileset;
        await read(tileset, ref.art.name);
      }));
    };
    await read(out.map, art.name);
    if ([out.map, ...Object.values(out.tilesets)].some(zstd)) out.problem = "zstd";
    return out;
  }

  /** A sheet's frames and its image, found by `meta.image`. */
  private async sprite(art: Artifact, v: ArtifactVersion): Promise<SpriteFiles> {
    const sheet = parseSpriteSheet(await this.resource(art, v).json().catch(() => null));
    if (!sheet) return { sheet: null, image: null, name: "", problem: "invalid" };
    const ref = this.ref(this.relative(sheet.image, art.name));
    const name = (ref?.art.name ?? sheet.image).split("/").pop()!;
    if (ref?.version.file) return { sheet, image: await this.blobOf(ref.version.file), name };
    return { sheet, image: null, name, problem: /^(?:[a-z][\w+.-]*:|\/|#)/i.test(sheet.image) ? "remote" : "missing" };
  }

  /** The files `content` names, as its manifest declares, each by the reference written there. */
  private filesOf(manifest: Manifest | undefined, content: unknown, owner: string): Map<string, Ref> {
    const files = new Map<string, Ref>();
    for (const { src } of referencesOf(manifest, content)) {
      const ref = this.ref(this.relative(src, owner));
      if (ref?.version.file && !files.has(src)) files.set(src, ref);
    }
    return files;
  }

  private async contents(files: Map<string, Ref>): Promise<Record<string, { data: ArrayBuffer; contentType: string }>> {
    const out: Record<string, { data: ArrayBuffer; contentType: string }> = {};
    await Promise.all([...files].map(async ([src, ref]) => { out[src] = { data: await (await this.blobOf(ref.version.file!)).arrayBuffer(), contentType: ref.version.file!.content_type }; }));
    return out;
  }

  /** A page whose own files reach it once it asks: a sandboxed page cannot read the review's blob URLs. */
  private async withFiles(doc: string, art: Artifact): Promise<string> {
    const files = this.filesOf(manifestOf(art.type), doc, art.name);
    if (!files.size) return doc;
    const blobs: Record<string, Blob> = {};
    await Promise.all([...files].map(async ([src, ref]) => { blobs[src] = await this.blobOf(ref.version.file!); }));
    return injectFiles(doc, blobs);
  }

  /** A document with the pictures it names swapped for blob URLs; one it cannot reach keeps its path. */
  private async withImages(text: string, art: Artifact): Promise<string> {
    const manifest = manifestOf(art.type);
    const files = this.filesOf(manifest, text, art.name);
    if (!files.size) return text;
    const urls = new Map<string, string>();
    await Promise.all([...files].map(async ([src, ref]) => { urls.set(src, urlOf(await this.blobOf(ref.version.file!))); }));
    return mapReferences(manifest, text, src => urls.get(src) ?? src) as string;
  }

  private async storyboard(v: ArtifactVersion, src: string): Promise<StoryboardView> {
    const art = [...this.byId.values()].find(a => a.versions.includes(v))!;
    const data = await this.resource(art, v).json();
    const parsed = parseStoryboard(data);
    const frame = async (f: StoryboardFrame, slide = false): Promise<StoryboardFrameView> => {
      const ref = this.ref(this.relative(f.src, src));
      const none: StoryboardFrameView = { src: f.src, alt: f.alt, href: null, ratio: null };
      if (!ref) return none;
      try {
        if (slide && ref.art.type === "html") {
          const text = await this.textOf(ref.version, "html");
          return text === null ? none : { src: f.src, alt: f.alt, href: ref.art.id, ratio: parsed!.size.width / parsed!.size.height, page: true, doc: await this.withFiles(text, ref.art) };
        }
        if (ref.art.type !== "image" || !ref.version.file) return none;
        const blob = await this.resource(ref.art, ref.version).blob();
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

/** The artifact ids a JSON version draws inside itself, as its type's manifest declares. */
function innerIds({ art, version }: Ref): string[] {
  return referencesOf(manifestOf(art.type), version.content).map(ref => ref.src);
}

const innerIdsOf = (ref: Ref | null) => (ref ? innerIds(ref) : []);

const pages = new Map<string, Record<string, Blob>>();

/** The page's references swapped for blob URLs it makes itself from the files the review hands it. */
function injectFiles(doc: string, files: Record<string, Blob>): string {
  if (typeof window === "undefined") return doc;
  if (!pages.size) {
    window.addEventListener("message", (event) => {
      const token = (event.data as { wildcraneFiles?: unknown } | null)?.wildcraneFiles;
      const held = typeof token === "string" ? pages.get(token) : undefined;
      if (held) (event.source as Window | null)?.postMessage({ wildcraneFiles: token, files: held }, "*");
    });
  }
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  pages.set(token, files);
  const script = `<script>(()=>{const t=${JSON.stringify(token)};addEventListener("message",e=>{const d=e.data;if(!d||d.wildcraneFiles!==t||!d.files)return;const u=Object.entries(d.files).map(([k,b])=>[k,URL.createObjectURL(b)]).sort((a,b)=>b[0].length-a[0].length);const fix=s=>u.reduce((s,[k,v])=>s.split(k).join(v),s);const run=()=>{for(const el of document.querySelectorAll("*")){for(const a of [...el.attributes]){const v=fix(a.value);if(v!==a.value)el.setAttribute(a.name,v)}if(el.tagName==="STYLE"){const v=fix(el.textContent);if(v!==el.textContent)el.textContent=v}}};document.readyState==="loading"?addEventListener("DOMContentLoaded",run):run()});parent.postMessage({wildcraneFiles:t},"*")})()</script>`;
  const head = /<head\b[^>]*>/i.exec(doc);
  return head ? doc.slice(0, head.index + head[0].length) + script + doc.slice(head.index + head[0].length) : script + doc;
}

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
