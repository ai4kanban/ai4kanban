"use client";

// shadcn DropdownMenu (Radix based), restyled to the soft neo-brutalism
// language — the panel and rows are ui/select.tsx's, so a command menu and an
// open select read as one family. The difference is what the rows are: a
// select's rows answer "which one", these do something when picked. Only the
// pieces the board uses are here — trigger, content, item, label, separator.

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    {/* z-[60] and the Escape stop are the select panel's, for the same
        reasons: clear the dialog scrim and the sheet, and keep an Escape that
        closes this menu from also closing the Dialog under it. */}
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      onEscapeKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "z-[60] min-w-[9rem] overflow-hidden rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1 text-nb-ink shadow-[3px_3px_0_0_var(--color-nb-ink)] data-[state=open]:animate-[nbPopIn_130ms_ease] data-[state=closed]:animate-[nbFadeOut_100ms_ease]",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-[7px] px-2.5 py-1.5 text-[13px] font-[600] text-nb-ink outline-none data-[highlighted]:bg-nb-wash data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[10.5px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-nb-ink/12", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
