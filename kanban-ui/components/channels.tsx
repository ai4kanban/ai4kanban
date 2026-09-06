"use client";

// The channels a marketing topic goes to (#411), as every screen draws one: the platform's
// own mark, and one dot saying how far that channel has got.
//
// A logo row is SCANNED, not read, so each mark wears its brand colour — the rule
// `components/brands.tsx` already sets for Slack and Lark. The marks themselves come from
// react-icons: Simple Icons carries X, Reddit and 小红书, and Font Awesome the LinkedIn it
// hasn't got.
//
// The dot is one shape carrying two facts. Filled means the piece is booked or already out;
// a ring means it is not going anywhere yet. The colour names which stage inside that, so
// four states read at a glance without four different shapes to learn.

import { FaLinkedin } from "react-icons/fa";
import { SiReddit, SiX, SiXiaohongshu } from "react-icons/si";
import { useCopy } from "@/i18n/use-copy";
import type { CardChannel, ChannelStatus } from "@/lib/types";

/** Each channel's mark and the colour it is drawn in. Keyed by the name the board writes
 *  (`cli/src/lib/channels.ts`); a name this build has no mark for draws none. */
const MARK: Record<string, { Icon: typeof SiX; colour: string; label: string }> = {
  x: { Icon: SiX, colour: "#0f0f0f", label: "X" },
  linkedin: { Icon: FaLinkedin, colour: "#0a66c2", label: "LinkedIn" },
  reddit: { Icon: SiReddit, colour: "#ff4500", label: "Reddit" },
  xiaohongshu: { Icon: SiXiaohongshu, colour: "#ff2442", label: "小红书" },
};

/** How each status is drawn. The names are the board's; the words are copy. */
const STATE: Record<ChannelStatus | "", { colour: string; filled: boolean }> = {
  "": { colour: "color-mix(in srgb, var(--color-nb-ink) 28%, transparent)", filled: false },
  draft: { colour: "var(--color-nb-sky)", filled: false },
  ready: { colour: "var(--color-nb-mint)", filled: false },
  scheduled: { colour: "var(--color-nb-lilac)", filled: true },
  published: { colour: "var(--color-nb-mint)", filled: true },
};

/** Every channel the board knows, in the order `cli/src/lib/channels.ts` names them — what
 *  the marketing card page's `+` offers once the chosen ones are taken out (#434). */
export const CHANNEL_NAMES = Object.keys(MARK);

/** What this channel is called, for a tooltip and for a tab. The platform's own name, in
 *  every language — a product name is not copy. */
export const channelLabel = (name: string): string => MARK[name]?.label ?? name;

/** How far this channel has got, in words. */
export function useChannelWord(): (status: ChannelStatus | "") => string {
  const c = useCopy().shared.channelStatus;
  return (status) => (status ? c[status] : c.none);
}

/** The platform's mark, in its own colour. Dimmed while nothing is written for it: the row
 *  then says which channels are chosen without any of them reading as work in hand. */
export function ChannelMark({
  name,
  status,
  size = 14,
  dim = !status,
}: {
  name: string;
  status: ChannelStatus | "";
  size?: number;
  /** Whether the mark is dimmed. Defaults to "nothing is written for it"; a picker offering
   *  a channel that has not been chosen at all overrides it (#434). */
  dim?: boolean;
}) {
  const mark = MARK[name];
  if (!mark) return null;
  const { Icon } = mark;
  return (
    <span className="inline-flex shrink-0" style={{ color: mark.colour, opacity: dim ? 0.38 : 1 }}>
      <Icon size={size} aria-hidden />
    </span>
  );
}

/** How far this channel has got, as one dot. */
export function ChannelDot({ status, size = 7 }: { status: ChannelStatus | ""; size?: number }) {
  const state = STATE[status];
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: state.filled ? state.colour : "transparent",
        boxShadow: state.filled ? undefined : `inset 0 0 0 1.5px ${state.colour}`,
      }}
    />
  );
}

/**
 * The channels this topic goes to, each with its status — the row a marketing card's face
 * wears at its foot, where a product card wears its ranking (#435). A topic is picked by
 * hand rather than ranked, so nothing is displaced.
 */
export function ChannelRow({ channels }: { channels: CardChannel[] }) {
  const word = useChannelWord();
  const c = useCopy().shared;
  if (channels.length === 0) return null;
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {channels.map((ch) => (
        <span
          key={ch.name}
          className="inline-flex items-center gap-1"
          title={c.channelAt(channelLabel(ch.name), word(ch.status))}
        >
          <ChannelMark name={ch.name} status={ch.status} />
          <ChannelDot status={ch.status} />
        </span>
      ))}
    </div>
  );
}
