// 组件清单（wildcrane.component.json）：内置与第三方组件用同一份声明说明内容引用了哪些文件、怎样算有效。
import builtins from '../builtin';
import { schemaProblem } from './schema';

/** Where content names another file. `json`: a `/`-path into JSON content, `*` matching every
 *  item; `text`: a regular expression, matched case-insensitively, whose first group is the
 *  reference, split by `list` when set. `types`: what a JSON file named there may be, first match wins. */
export type Reference = ({ json: string } | { text: string; list?: string }) & { types?: string[] };

export interface Manifest {
  name: string;
  types: string[];
  title?: { en: string; zh: string };
  schema?: unknown;
  references?: Reference[];
}

/** A reference found in content: its line for text, its JSON path otherwise. */
export interface Found {
  src: string;
  types: string[];
  text: boolean;
  line?: number;
  at?: string;
}

const BUILTINS = builtins as Manifest[];

export const manifestOf = (type: string): Manifest | undefined => BUILTINS.find(m => m.types.includes(type));

/** The first of `types` whose schema `data` holds; with one type, that type and why it does not. */
export function typeOf(data: unknown, types: string[]): { type: string | null; problem?: string } {
  for (const type of types) if (!schemaProblem(manifestOf(type)?.schema, data)) return { type };
  if (types.length !== 1) return { type: null };
  return { type: types[0]!, problem: `does not match ${types[0]} at ${schemaProblem(manifestOf(types[0]!)?.schema, data)}` };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A URL the page loads from elsewhere, or none at all. */
const remote = (src: string) => !src || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(src);

function mapJson(node: unknown, keys: string[], at: string, visit: (src: string, at: string) => string): unknown {
  if (!keys.length) return typeof node === 'string' && node ? visit(node, at) : node;
  const [key, ...rest] = keys as [string, ...string[]];
  if (Array.isArray(node)) {
    if (key === '*') return node.map((x, i) => mapJson(x, rest, `${at}/${i}`, visit));
    const i = Number(key);
    return Number.isInteger(i) && i in node ? node.map((x, j) => (j === i ? mapJson(x, rest, `${at}/${j}`, visit) : x)) : node;
  }
  if (!isObject(node)) return node;
  const out: Record<string, unknown> = { ...node };
  for (const k of key === '*' ? Object.keys(node) : key in node ? [key] : []) out[k] = mapJson(node[k], rest, `${at}/${k}`, visit);
  return out;
}

function mapText(text: string, rule: { text: string; list?: string }, visit: (src: string, line: number) => string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(new RegExp(rule.text, 'gid'))) {
    const span = m.indices?.[1];
    if (!span || m[1] === undefined) continue;
    const line = text.slice(0, span[0]).split('\n').length;
    const one = (src: string) => (remote(src) ? src : visit(src, line));
    const value = rule.list
      ? m[1].split(rule.list).map(part => part.replace(/^(\s*)(\S+)/, (_, space: string, src: string) => space + one(src))).join(rule.list)
      : one(m[1]);
    out += text.slice(last, span[0]) + value;
    last = span[1];
  }
  return out + text.slice(last);
}

/** `content` with each reference `manifest` declares replaced by what `map` returns for it. */
export function mapReferences(manifest: Manifest | undefined, content: unknown, map: (src: string, found: Found) => string): unknown {
  for (const rule of manifest?.references ?? []) {
    const types = rule.types ?? [];
    if ('json' in rule) {
      if (typeof content !== 'string') content = mapJson(content, rule.json.split('/').filter(Boolean), '', (src, at) => map(src, { src, types, text: false, at: at || '/' }));
    } else if (typeof content === 'string') {
      content = mapText(content, rule, (src, line) => map(src, { src, types, text: true, line }));
    }
  }
  return content;
}

/** Every reference `manifest` declares in `content`, in order. */
export function referencesOf(manifest: Manifest | undefined, content: unknown): Found[] {
  const found: Found[] = [];
  mapReferences(manifest, content, (src, ref) => (found.push(ref), src));
  return found;
}
