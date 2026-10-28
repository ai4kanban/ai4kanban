// The part of JSON Schema a component's `schema` is checked with before a save (#2006): what
// artifact-sdk/README.md lists. Anything else in a schema is ignored, never refused.

type Schema = Record<string, unknown>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function typeOk(type: unknown, v: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) =>
    t === "null" ? v === null
    : t === "array" ? Array.isArray(v)
    : t === "object" ? isObj(v)
    : t === "integer" ? Number.isInteger(v)
    : t === "number" ? typeof v === "number" && Number.isFinite(v)
    : typeof v === t,
  );
}

/** Where `value` first breaks `schema`, as a path like `/2/start`; `null` when it holds. */
export function schemaProblem(schema: unknown, value: unknown, at = ""): string | null {
  if (!isObj(schema)) return null;
  const s = schema as Schema;
  const here = at || "/";
  if (s.type !== undefined && !typeOk(s.type, value)) return here;
  if (Array.isArray(s.enum) && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) return here;
  if (s.const !== undefined && JSON.stringify(s.const) !== JSON.stringify(value)) return here;
  if (typeof value === "string") {
    if (typeof s.minLength === "number" && value.length < s.minLength) return here;
    if (typeof s.maxLength === "number" && value.length > s.maxLength) return here;
    if (typeof s.pattern === "string") {
      try {
        if (!new RegExp(s.pattern, "u").test(value)) return here;
      } catch {
        /* a pattern this browser cannot read checks nothing */
      }
    }
  }
  if (typeof value === "number") {
    if (typeof s.minimum === "number" && value < s.minimum) return here;
    if (typeof s.maximum === "number" && value > s.maximum) return here;
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === "number" && value.length < s.minItems) return here;
    if (typeof s.maxItems === "number" && value.length > s.maxItems) return here;
    if (isObj(s.items)) {
      for (let i = 0; i < value.length; i++) {
        const bad = schemaProblem(s.items, value[i], `${at}/${i}`);
        if (bad) return bad;
      }
    }
  }
  if (isObj(value)) {
    const props = isObj(s.properties) ? s.properties : {};
    if (Array.isArray(s.required)) for (const k of s.required) if (typeof k === "string" && !(k in value)) return `${at}/${k}`;
    for (const [k, v] of Object.entries(value)) {
      if (k in props) {
        const bad = schemaProblem(props[k], v, `${at}/${k}`);
        if (bad) return bad;
      } else if (s.additionalProperties === false) return `${at}/${k}`;
      else if (isObj(s.additionalProperties)) {
        const bad = schemaProblem(s.additionalProperties, v, `${at}/${k}`);
        if (bad) return bad;
      }
    }
  }
  return null;
}
