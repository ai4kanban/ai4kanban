// The AI chat's entry, shared by the review page and WildCrane Web's card page (#2088): a
// "Discuss with AI" bubble in the page's lower right, counting the card's open questions; open,
// the chat floats above it and the bubble turns into an X. At phone width the page draws the
// chat over itself and leads its top row with AiBackButton. Esc closes it.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronLeft, FiMessageCircle, FiX } from "react-icons/fi";
import { Button } from "./button";
import { useEscape } from "./chat";
import { HAIRLINE } from "./chrome";

type Copy = { open: string; close: string; toCard: string; backToCard: string };

/** `auto` opens the chat once per value it takes, the first time it is set: a card with open
 *  questions opens on its chat, and closing it keeps it closed for this visit. */
export function useAiOpen(initial = false, auto: string | null = null) {
  const [open, setOpen] = useState(initial || !!auto);
  const opened = useRef(new Set(auto ? [auto] : []));
  const close = useCallback(() => setOpen(false), []);
  useEscape(open, close);
  useEffect(() => {
    if (!auto || opened.current.has(auto)) return;
    opened.current.add(auto);
    setOpen(true);
  }, [auto]);
  return [open, setOpen] as const;
}

/** Drawn inside the page's `relative` sheet. */
export function AiCorner({
  c,
  open,
  phone,
  count,
  onToggle,
  children,
}: {
  c: Copy;
  open: boolean;
  phone: boolean;
  /** Open questions waiting on the bubble. */
  count?: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (open && phone) return null;
  if (open)
    return (
      <>
        <div className="nb-pop origin-bottom-right absolute bottom-[76px] right-5 z-40">{children}</div>
        <Button onClick={onToggle} className="absolute bottom-5 right-5 z-40 size-11 rounded-full p-0" aria-label={c.close} title={c.close}>
          <FiX className="text-[18px]" aria-hidden />
        </Button>
      </>
    );
  return (
    <Button onClick={onToggle} className="absolute bottom-5 right-5 z-40 rounded-full max-md:bottom-4 max-md:right-4">
      <FiMessageCircle className="text-[16px]" aria-hidden />
      {c.open}
      {!!count && (
        <span className="-mr-1 ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-[700] tabular-nums text-nb-accent-deep">
          {count}
        </span>
      )}
    </Button>
  );
}

/** The phone top row's way back from the chat to the card, drawn like the find box beside it. */
export function AiBackButton({ c, onClick }: { c: Copy; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={c.backToCard}
      title={c.backToCard}
      className="inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-0.5 rounded-[8px] border bg-nb-paper pl-1.5 pr-2.5 text-[13px] font-[600] text-nb-ink"
      style={{ borderColor: HAIRLINE }}
    >
      <FiChevronLeft className="text-[16px]" aria-hidden />
      {c.toCard}
    </button>
  );
}
