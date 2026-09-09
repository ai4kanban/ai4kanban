// What a source looks like on the triage page (#560).
//
// One table, keyed on the same `source_type` keys the CLI's source list carries
// (cli/src/lib/signals/sources.ts). A key in it is drawn as its brand mark and the brand's
// own spelling; a key that is not is drawn as the key itself, with no mark. Nothing here
// guesses at a platform from free text, and there is no neutral globe standing in for a
// source nobody named.
//
// The names are not translated. A brand is spelled one way — 小红书 is 小红书 under an English
// heading — and the app's language setting has nothing to say about it.

import { SiReddit, SiSinaweibo, SiX, SiXiaohongshu, SiYoutube, SiZhihu } from "react-icons/si";

type Mark = { name: string; Icon: typeof SiReddit; color: string };

const MARKS: Record<string, Mark> = {
  reddit: { name: "Reddit", Icon: SiReddit, color: "#ff4500" },
  x: { name: "X", Icon: SiX, color: "#0f0f0f" },
  xiaohongshu: { name: "小红书", Icon: SiXiaohongshu, color: "#ff2442" },
  weibo: { name: "微博", Icon: SiSinaweibo, color: "#e6162d" },
  zhihu: { name: "知乎", Icon: SiZhihu, color: "#0084ff" },
  youtube: { name: "YouTube", Icon: SiYoutube, color: "#ff0000" },
};

/** What a source type is called: the brand's own spelling when the table has it, the key
 *  itself when it hasn't, and the page's word for "nothing said" when there is no key. */
export const sourceName = (type: string, none: string): string => (type ? (MARKS[type]?.name ?? type) : none);

/** The brand mark, or nothing at all for a key the table has not got. */
export function SourceMark({ type, size = 13 }: { type: string; size?: number }) {
  const known = MARKS[type];
  if (!known) return null;
  const { Icon, color } = known;
  return <Icon size={size} color={color} className="shrink-0" aria-hidden />;
}
