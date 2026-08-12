"use client";

// shadcn Resizable (react-resizable-panels based), restyled to the window's
// language. Only what the board needs is wired up: a horizontal group with one
// draggable divider between the rail and the body.
//
// The divider is not a border. The window draws no line between the rail and
// the body — they are cream and paper standing next to each other — so the
// handle is an empty strip of that cream until you reach for it, and only then
// does it put an ink hairline under the pointer. The strip itself is 4px, which
// would be a cruel thing to aim at; the library widens the hit target on its own
// (10px for a mouse, 20px for a finger), so the hairline is the mark and not the
// target.
//
// Double-clicking a divider puts its panel back to `defaultSize`.

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

// The group and the panel are taken as they come: the library lays both out with
// inline flex styles, so a class of our own here would only be overridden. What
// the board wants from them — a width, a floor, a ceiling — is said at the call
// site (components/Window.tsx).
const ResizablePanelGroup = ResizablePrimitive.Group;
const ResizablePanel = ResizablePrimitive.Panel;

/** The divider, in four states. The library reports which one it is in on
 *  `data-separator`, and a divider keeps focus after a drag — so plain focus is
 *  drawn no louder than hover, and only a `:focus-visible` one, which is to say a
 *  divider reached with the keyboard, gets the ember. Arrow keys move it, and a
 *  tab stop you cannot see is a tab stop you cannot use. */
function ResizableHandle({ className, ...props }: ResizablePrimitive.SeparatorProps) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        "relative w-1 shrink-0 cursor-col-resize outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[1.5px] after:-translate-x-1/2 after:bg-nb-ink after:opacity-0 after:transition-opacity after:duration-100",
        "data-[separator=hover]:after:opacity-20 data-[separator=focus]:after:opacity-20",
        "data-[separator=active]:after:opacity-45",
        // Both variants, so this outweighs the plain focus rule above rather
        // than tying with it and leaving the winner to source order.
        "focus-visible:data-[separator=focus]:after:bg-nb-accent focus-visible:data-[separator=focus]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
