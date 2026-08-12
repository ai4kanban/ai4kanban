"use client";

// shadcn Sheet (Radix Dialog based), restyled to the soft neo-brutalism
// language. Only the right side is wired up here — that is all the board needs.
// The built-in close uses react-icons' FiX (we deliberately avoid lucide); it is
// optional so callers can supply their own header/close instead.

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { FiX } from "react-icons/fi";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    // The scrim covers the top of the window, which in the app on macOS is the
    // title bar and drags it. Clicking a scrim closes the sheet; it must not
    // move the window instead (app/globals.css).
    data-a4k-overlay
    className={cn(
      "fixed inset-0 z-50 data-[state=open]:animate-[nbFadeIn_180ms_ease] data-[state=closed]:animate-[nbFadeOut_150ms_ease]",
      className,
    )}
    style={{
      background: "color-mix(in srgb, var(--color-nb-ink) 42%, transparent)",
    }}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    /** Show the built-in top-right close button. Off by default — the card
     *  detail renders its own header close. */
    showClose?: boolean;
  }
>(({ className, children, showClose = false, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-dvh flex-col outline-none data-[state=open]:animate-[nbSlideInRight_220ms_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[nbSlideOutRight_180ms_ease-in]",
        className,
      )}
      style={{
        width: "min(560px, 100vw)",
        background: "var(--color-nb-paper)",
        borderLeft: "1.5px solid var(--color-nb-ink)",
        boxShadow: "-4px 0 0 0 var(--color-nb-ink)",
      }}
      {...props}
    >
      {children}
      {showClose && (
        <SheetPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 text-[18px] leading-none text-nb-ink-soft transition-colors hover:text-nb-ink"
        >
          <FiX />
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-[15px] font-[800] tracking-[-0.02em]", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-nb-ink-soft", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetPortal,
  SheetOverlay,
};
