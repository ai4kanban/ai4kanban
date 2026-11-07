// TexturePacker 的 JSON (Hash/Array) 帧数据（#481）。

/** Where a frame sits in the sheet (`w`/`h` before rotation) and where it lands in its source size. */
export type SpriteFrame = { x: number; y: number; w: number; h: number; rotated: boolean; dx: number; dy: number; sw: number; sh: number };
export type SpriteAction = { name: string; frames: number[] };
export type SpriteSheet = { image: string; frames: SpriteFrame[]; actions: SpriteAction[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

function frameOf(f: unknown): SpriteFrame | null {
  if (!isObj(f) || !isObj(f.frame)) return null;
  const r = f.frame;
  const [x, y, w, h] = [num(r.x), num(r.y), num(r.w), num(r.h)];
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const trim = isObj(f.spriteSourceSize) ? f.spriteSourceSize : {};
  const size = isObj(f.sourceSize) ? f.sourceSize : {};
  const dx = num(trim.x) || 0;
  const dy = num(trim.y) || 0;
  return { x, y, w, h, rotated: f.rotated === true, dx, dy, sw: Math.max(num(size.w) || 0, dx + w), sh: Math.max(num(size.h) || 0, dy + h) };
}

/** Actions by frame name: extension and trailing number dropped, each sorted by its number. */
export function groupFrames(names: string[]): SpriteAction[] {
  const groups = new Map<string, { at: number; n: number }[]>();
  let numbered = false;
  names.forEach((name, at) => {
    const m = /^(.*?)[_\- /]?(\d+)$/.exec(name.replace(/\.[a-z0-9]+$/i, ""));
    if (m) numbered = true;
    const key = m ? m[1]! : name;
    groups.set(key, [...(groups.get(key) ?? []), { at, n: m ? Number(m[2]) : 0 }]);
  });
  if (!numbered) return [{ name: "", frames: names.map((_, i) => i) }];
  return [...groups].map(([name, list]) => ({ name, frames: list.sort((a, b) => a.n - b.n).map((f) => f.at) }));
}

/** The sheet `data` describes, or `null` when its frames cannot be read. */
export function parseSpriteSheet(data: unknown): SpriteSheet | null {
  if (!isObj(data) || !isObj(data.meta) || typeof data.meta.image !== "string") return null;
  const entries: [string, unknown][] = Array.isArray(data.frames)
    ? data.frames.map((f, i) => [isObj(f) && typeof f.filename === "string" ? f.filename : String(i), f])
    : isObj(data.frames) ? Object.entries(data.frames) : [];
  const frames = entries.map(([, f]) => frameOf(f));
  if (!frames.length || frames.some((f) => !f)) return null;
  const names = entries.map(([name]) => name);
  const named = isObj(data.animations)
    ? Object.entries(data.animations).flatMap(([name, list]) => {
        const at = Array.isArray(list) ? list.map((n) => names.indexOf(String(n))).filter((i) => i >= 0) : [];
        return at.length ? [{ name, frames: at }] : [];
      })
    : [];
  return { image: data.meta.image, frames: frames as SpriteFrame[], actions: named.length ? named : groupFrames(names) };
}
