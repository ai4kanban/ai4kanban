import Link from "next/link";
import { FiCheck } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { BecameCard } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A card a discussion was written into (#1535), by where it stands now: on the board,
 *  done, or dropped — faded once it has left. A card whose file is gone is its id alone. */
export function BecameLine({ card, link = true, className }: { card: BecameCard; link?: boolean; className?: string }) {
  const c = useCopy().shared.became;
  const left = card.state === "done" || card.state === "dropped";
  const ink = card.state ? undefined : { color: "var(--color-nb-accent-deep)" };
  const inner = (
    <>
      {card.state === "done" && <FiCheck size={12} className="shrink-0" aria-hidden />}
      <span className={cn("shrink-0", !card.state && "text-nb-ink-soft")}>
        {card.state === "done" ? c.done : card.state === "dropped" ? c.dropped : c.open}
      </span>
      <span className="shrink-0 font-[700]" style={ink}>#{card.id}</span>
      {card.state !== "gone" && card.title && <span className="truncate font-[600]" style={ink}>{card.title}</span>}
    </>
  );
  const shape = cn("flex min-w-0 items-center gap-1.5", card.state && "text-nb-ink-soft", left && "opacity-70", className);
  if (!link || card.state === "gone") return <span className={shape}>{inner}</span>;
  return (
    <Link href={`/${card.id}`} className={cn(shape, "hover:underline")}>
      {inner}
    </Link>
  );
}
