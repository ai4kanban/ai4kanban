// Stands in for legacy ui/dropdown-menu.tsx (Radix): a trigger and a list that closes on a
// pick, Esc or a click outside. The panel wears legacy ui/popover.tsx's POPUP_PANEL.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { closing, useShown } from "../lib/motion";
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
  const shown = useShown(open);
  const box = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLSpanElement>(null);
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
  // The list sits on `body` so no scrolling or clipped ancestor cuts it; it opens upward when there is more room above.
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const el = list.current;
      const r = box.current?.getBoundingClientRect();
      if (!el || !r) return;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      el.style.setProperty("--menu-w", `${r.width}px`);
      el.style.maxHeight = "360px";
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const up = el.offsetHeight > below && above > below;
      el.style.maxHeight = `${Math.min(360, up ? above : below)}px`;
      el.style.top = up ? "auto" : `${r.bottom + 4}px`;
      el.style.bottom = up ? `${vh - r.top + 4}px` : "auto";
      const w = el.offsetWidth;
      el.style.left = `${Math.max(8, Math.min(align === "end" ? r.right - w : r.left, vw - 8 - w))}px`;
      el.style.transformOrigin = `${up ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`;
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [shown, align]);
  // Keep Tab moving trigger → items → what follows the trigger, as if the list sat right after it.
  const focusables = () => [...(list.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]") ?? [])];
  const opener = () => box.current?.querySelector<HTMLElement>("button, [tabindex]");
  return (
    <span
      ref={box}
      className={cn("relative min-w-0", full ? "flex w-full" : "inline-flex")}
      onKeyDown={(e) => {
        if (!open || e.key !== "Tab" || e.shiftKey || list.current?.contains(e.target as Node)) return;
        const first = focusables()[0];
        if (!first) return;
        e.preventDefault();
        first.focus();
      }}
    >
      {trigger({ open, onClick: () => setOpen((v) => !v) })}
      {shown &&
        createPortal(
          <span
            ref={list}
            role="menu"
            data-closing={closing(open)}
            // Stops a dialog or popover around the trigger from reading a click here as one outside it.
            onPointerDown={(e) => e.nativeEvent.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const all = focusables();
              if (e.shiftKey ? e.target === all[0] : e.target === all[all.length - 1]) {
                if (e.shiftKey) e.preventDefault();
                opener()?.focus();
              }
            }}
            className={cn(POPUP_PANEL, "nb-pop fixed z-[70] flex min-w-[160px] flex-col overflow-y-auto p-1", full && "w-[var(--menu-w)]", panel)}
          >
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
          </span>,
          document.body,
        )}
    </span>
  );
}
