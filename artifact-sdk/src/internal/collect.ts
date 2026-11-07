import { manifestOf, referencesOf, typeOf, type Found } from './manifest';
import { bodyReferences, kindOf, type Source } from './references';

/** Why a file's content, or a file it names, cannot be shown: by line in text, by path in JSON. */
export interface Problem {
  src: string;
  line?: number;
  at?: string;
  message: string;
}

export interface Collected {
  key: string;
  file: string | null;
  /** Its component type: declared by whoever names it, else from its extension. */
  kind: string;
  /** Parsed JSON, or the text its references were read from. */
  data?: unknown;
  /** Why this node, or a file it references, cannot be shown. */
  error?: string;
  /** This file's own problems, each where it stands. */
  problems: Problem[];
  dependencies: Map<string, string>;
  aliases: Set<string>;
}
export interface CollectorHost {
  /** Throws why a path is refused or missing. */
  resolve: (src: string, owner: string) => { key: string; file: string | null } | null;
  /** The text a file's references are read from: a page as it will be drawn. */
  read: (file: string) => string;
  retained: (key: string) => Source[];
}

const extOf = (file: string) => /\.[^./\\]+$/.exec(file)?.[0].toLowerCase() ?? '';
const why = (error: unknown) => (error instanceof Error ? error.message : String(error));
// A schema checks JSON only, so a type declaring one never names another file.
const textKind = (ext: string, types: string[]) => types.find(t => { const m = manifestOf(t); return m && !m.schema; }) ?? kindOf(ext);
const kindAt = (src: string, types: string[]) => (extOf(src) === '.json' ? (types.includes('asset') ? 'asset' : types[0] ?? 'asset') : textKind(extOf(src), types));

/** 依赖优先的可达节点。文件的问题记在该节点上，并传给引用它的节点；只有循环抛错。 */
export function collect(body: string, card: string, host: CollectorHost): Collected[] {
  const nodes = new Map<string, Collected>();
  const active = new Set<string>();
  const out: Collected[] = [];
  const visit = (src: string, types: string[], owner: string): { key: string | null; error?: string } => {
    const path = src.replace(/[?#].*$/, '');
    let resolved: ReturnType<CollectorHost['resolve']>;
    try { resolved = host.resolve(path, owner); }
    catch (error) {
      if (owner !== card) return { key: null, error: why(error) };
      if (!nodes.has(src)) {
        const node: Collected = { key: src, file: null, kind: kindAt(path, types), error: why(error), problems: [], dependencies: new Map(), aliases: new Set([src]) };
        nodes.set(src, node);
        out.push(node);
      }
      return { key: src, error: nodes.get(src)!.error };
    }
    if (!resolved) return { key: null };
    const { key, file } = resolved;
    if (active.has(key)) throw new Error(`${owner}: ${src}: 资源依赖循环`);
    const json = !!file && extOf(file) === '.json';
    const held = nodes.get(key);
    if (held) {
      if (owner === card) held.aliases.add(src);
      if (held.error || !json || !types.length || held.kind !== 'asset') return { key, error: held.error };
      // 同一个 JSON 可能先作为附件、再作为分镜被引用。
      out.splice(out.indexOf(held), 1);
    }
    const node: Collected = { key, file, kind: 'asset', problems: [], dependencies: new Map(), aliases: held?.aliases ?? new Set([key]) };
    if (owner === card) node.aliases.add(src);
    nodes.set(key, node);
    active.add(key);
    const child = (ref: Found | Source, from: string) => {
      const found = visit(ref.src, ref.types, from);
      if (found.key) node.dependencies.set(ref.src, found.key);
      else if (found.error) node.problems.push({ src: ref.src, ...('line' in ref ? { line: ref.line } : {}), ...('at' in ref ? { at: ref.at } : {}), message: found.error });
      node.error ??= found.error;
    };
    if (file) {
      if (json) {
        try {
          node.data = JSON.parse(host.read(file)) as unknown;
          const typed = typeOf(node.data, types);
          node.kind = typed.type ?? 'asset';
          if (typed.problem) node.problems.push({ src: file, message: `${typed.problem}: ${file}` });
        } catch {
          node.problems.push({ src: file, message: `not valid JSON: ${file}` });
        }
      } else {
        node.kind = textKind(extOf(file), types);
        try { if (manifestOf(node.kind)?.references) node.data = host.read(file); }
        catch (error) { node.problems.push({ src: file, message: why(error) }); }
      }
      node.error = node.problems[0]?.message;
      if (!node.error) for (const ref of referencesOf(manifestOf(node.kind), node.data)) child(ref, file);
    } else {
      for (const ref of host.retained(key)) child(ref, card);
    }
    active.delete(key);
    out.push(node);
    return { key, error: node.error };
  };
  for (const ref of bodyReferences(body)) visit(ref.src, ref.types, card);
  const sorted: Collected[] = [];
  const done = new Set<string>();
  const order = (node: Collected) => {
    if (done.has(node.key)) return;
    done.add(node.key);
    for (const key of node.dependencies.values()) { const child = nodes.get(key); if (child) order(child); }
    sorted.push(node);
  };
  for (const node of out) order(node);
  return sorted;
}

export const problemText = (p: Problem): string => `${p.line ? `line ${p.line}: ` : p.at ? `${p.at}: ` : ''}${p.src}: ${p.message}`;
