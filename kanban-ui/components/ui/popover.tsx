"use client";

// Radix Popover in ui/select.tsx's panel, for the popups a Select or a DropdownMenu cannot
// be: one with a box to type in (a searchable list, a free-text box with suggestions, an
// inline editor). Positioning, outside press, nested Escape and focus return are Radix's,
// shared with the Select and the menu, so the three dismiss the same way.
//
// The interaction states every popup and its trigger wear live here too, so a Select, a
// menu and a picker answer hover, focus, press, pick and open alike.

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { FiCheck, FiSearch } from "react-icons/fi";

import { cn } from "@/lib/utils";

/** The open panel: an ink-framed paper block with the hard shadow, over the dialog (z-50). */
export const POPUP_PANEL =
  "z-[60] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[3px_3px_0_0_var(--color-nb-ink)] data-[state=open]:animate-[nbPopIn_130ms_ease] data-[state=closed]:animate-[nbFadeOut_100ms_ease] motion-reduce:animate-none";

/** One row of an open list. Highlight is the wash, whether the pointer, the arrow keys or
 *  Radix put it there; a pick is marked by its check, not by a fill. */
export const POPUP_ROW =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-[600] text-nb-ink outline-none transition-colors duration-100 hover:bg-nb-wash focus-visible:bg-nb-wash data-[highlighted]:bg-nb-wash data-[active=true]:bg-nb-wash active:bg-nb-canvas disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 motion-reduce:transition-none";

/** What opens a popup: a little darker under the pointer, pressed down on a click, and the
 *  ember ring while its popup is open. */
export const POPUP_TRIGGER =
  "transition-[filter,transform] duration-100 enabled:hover:brightness-[0.96] enabled:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent data-[state=open]:outline-2 data-[state=open]:outline-offset-1 data-[state=open]:outline-nb-accent aria-expanded:outline-2 aria-expanded:outline-offset-1 aria-expanded:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, onEscapeKeyDown, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={8}
      // The custom Dialog closes on a window Escape; this one closes only the popup.
      onEscapeKeyDown={(e) => {
        e.stopPropagation();
        onEscapeKeyDown?.(e);
      }}
      className={cn(
        POPUP_PANEL,
        "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-1 outline-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/** Arrow keys, Home and End walk the enabled `role="option"` rows under the element this is
 *  put on; from a text box, ArrowDown steps into the list and ArrowUp off its top comes back. */
export function stepOptions(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const rows = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)'),
  );
  const at = rows.indexOf(document.activeElement as HTMLElement);
  // In the search box Home and End move the caret.
  if (!rows.length || (at < 0 && (e.key === "Home" || e.key === "End"))) return;
  e.preventDefault();
  const search = e.currentTarget.querySelector<HTMLElement>("[data-popup-search]");
  if (e.key === "ArrowUp" && at === 0 && search) return search.focus();
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? rows.length - 1
        : e.key === "ArrowDown"
          ? (at + 1) % rows.length
          : (at <= 0 ? rows.length : at) - 1;
  rows[next]?.focus();
}

/** The search box at a searchable list's head. Radix focuses it as the popup opens. */
function PopoverSearch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative mb-1 p-1">
      <FiSearch aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-nb-ink-soft" />
      <input
        data-popup-search
        type="text"
        spellCheck={false}
        autoComplete="off"
        className={cn(
          "w-full rounded-[8px] bg-nb-wash py-1.5 pl-8 pr-2.5 text-[12px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** A row of a searchable list: a button that picks, with the check when it is the one. */
function PopoverOption({
  selected,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={!!selected}
      className={cn(POPUP_ROW, "pr-8", className)}
      {...props}
    >
      {children}
      {selected && (
        <span className="absolute right-2.5 flex items-center text-nb-accent-deep">
          <FiCheck aria-hidden className="size-[13px]" />
        </span>
      )}
    </button>
  );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent, PopoverSearch, PopoverOption };
