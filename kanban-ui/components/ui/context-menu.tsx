"use client";

// shadcn ContextMenu (Radix based), with dropdown-menu.tsx's panel and rows. Only the pieces
// the board uses are here.

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import * as React from "react";

import { cn } from "@/lib/utils";

import { POPUP_PANEL, POPUP_ROW } from "./popover";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    {/* z-[60] and the Escape stop are dropdown-menu.tsx's. */}
    <ContextMenuPrimitive.Content
      ref={ref}
      onEscapeKeyDown={(e) => e.stopPropagation()}
      className={cn(
        POPUP_PANEL,
        "max-h-[var(--radix-context-menu-content-available-height)] min-w-[9rem] overflow-y-auto p-1",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(POPUP_ROW, className)} {...props} />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem };
