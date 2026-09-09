// The sources triage knows, as one table (#560).
//
// A row is a source: the key a file writes, the ways people write its name, and the sites it
// is served from. Adding a source is adding a row — nothing anywhere reads a source by name,
// and no source has a branch of its own.
//
// One rule reads every way in. A pull's `source_type`, a pull's older `platform`/`source`,
// `akb triage add --source`, a pasted link's domain and a file already on disk all come down
// to one string, and that string either matches a row or it does not. What does not match is
// kept as it was written rather than guessed at.

/** One source: what a file calls it, what people call it, and where it is served from. */
export interface SourceType {
  /** What `source_type` carries, and what the UI's icon table is keyed on. */
  key: string
  /** The other common spellings, in any language. The key itself always matches. */
  aliases: string[]
  /** The sites it is served from. A subdomain of one of these matches too. */
  domains: string[]
}

/** The list, in the order groups are drawn in. */
export const SOURCE_TYPES: SourceType[] = [
  { key: 'reddit', aliases: [], domains: ['reddit.com', 'redd.it'] },
  { key: 'x', aliases: ['twitter', '推特'], domains: ['x.com', 'twitter.com', 't.co'] },
  { key: 'xiaohongshu', aliases: ['小红书', 'rednote'], domains: ['xiaohongshu.com', 'xhslink.com'] },
  { key: 'weibo', aliases: ['微博', '新浪微博'], domains: ['weibo.com', 'weibo.cn'] },
  { key: 'zhihu', aliases: ['知乎'], domains: ['zhihu.com'] },
  { key: 'youtube', aliases: ['油管'], domains: ['youtube.com', 'youtu.be'] },
]

/** The keys, in the list's order — what orders the groups on the page. */
export const sourceTypeKeys = (): string[] => SOURCE_TYPES.map((row) => row.key)

/** Which source a free text or a domain names, or empty when it names none of them.
 *
 *  Case is ignored and a subdomain counts as its domain. There is no partial match and no
 *  fallback: this is the whole of what the board claims to recognise. */
export function matchSourceType(said: string): string {
  const one = said.trim().toLowerCase()
  if (!one) return ''
  for (const row of SOURCE_TYPES) {
    if (one === row.key || row.aliases.some((alias) => alias.toLowerCase() === one)) return row.key
    if (row.domains.some((domain) => one === domain || one.endsWith(`.${domain}`))) return row.key
  }
  return ''
}

/** A `source_type` as it is stored: the list's key when it names one, and otherwise exactly
 *  what was sent — an endpoint may carry a source the board has never heard of. */
export const readSourceType = (said: string): string => matchSourceType(said) || said.trim()
