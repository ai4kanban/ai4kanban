// Stands in for legacy ui/dropdown-menu.tsx (Radix): a trigger and a list that closes on a
// pick, Esc or a click outside. The panel wears legacy ui/popover.tsx's POPUP_PANEL.

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export const POPUP_PANEL = "rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[3px_3px_0_0_var(--color-nb-ink)]";
export const ITEM = "flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-[600] text-nb-ink no-underline hover:bg-nb-wash";

export type MenuEntry = { key: string | number; body: React.ReactNode; onSelect: () => void; className?: string };

export function Menu({
  trigger,
  items,
  head,
  align = "start",
  full = false,
  panel,
}: {
  trigger: (props: { open: boolean; onClick: () => void }) => React.ReactNode;
  items: MenuEntry[];
  /** Content above the items that is not itself a pick, e.g. a select; using it keeps the list open. */
  head?: React.ReactNode;
  align?: "start" | "end";
  /** The trigger and the list take the whole width. */
  full?: boolean;
  /** Classes for the list, after the defaults. */
  panel?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span ref={box} className={cn("relative min-w-0", full ? "flex w-full" : "inline-flex")}>
      {trigger({ open, onClick: () => setOpen((v) => !v) })}
      {open && (
        <span role="menu" className={cn(POPUP_PANEL, "absolute top-[calc(100%+4px)] z-30 flex max-h-[min(360px,50vh)] min-w-[160px] flex-col overflow-y-auto p-1", full && "w-full", align === "end" ? "right-0" : "left-0", panel)}>
          {head}
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={cn(ITEM, it.className)}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.body}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
