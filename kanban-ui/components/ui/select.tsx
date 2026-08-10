"use client";

// shadcn Select (Radix Select based), restyled to the soft neo-brutalism
// language — the board's one dropdown, replacing the native <select> so the
// open list is ours on every platform: an ink-framed paper panel with the hard
// offset shadow, not the OS menu. Icons are react-icons' Fi set (we
// deliberately avoid lucide).
//
// The default trigger is the settings-pane box (the CONTROL frame in
// Configuration.tsx). A caller with its own frame — the header's release
// sticker, a card's level chip — restyles it through className; `cn` lets those
// overrides win. The chevron and check are sized `1em`, so they follow the
// trigger's/item's own font size instead of needing an override of their own.

import * as SelectPrimitive from "@radix-ui/react-select";
import * as React from "react";
import { FiCheck, FiChevronDown, FiChevronUp } from "react-icons/fi";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 text-left text-[14px] text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-nb-ink-soft/60 [&>span]:min-w-0 [&>span]:truncate",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <FiChevronDown aria-hidden className="size-[1em] shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-nb-ink-soft", className)}
    {...props}
  >
    <FiChevronUp aria-hidden className="size-3" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-nb-ink-soft", className)}
    {...props}
  >
    <FiChevronDown aria-hidden className="size-3" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    {/* z-[60]: the list portals to <body>, so it must clear the dialog scrim
        and the sheet (both z-50) it may be opened from. */}
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      // The custom Dialog closes on a window keydown Escape. Radix hears the
      // key first (document, capture); stopping it here closes just this list,
      // the way a native select's Escape never reaches the page.
      onEscapeKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "relative z-[60] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[3px_3px_0_0_var(--color-nb-ink)] data-[state=open]:animate-[nbPopIn_130ms_ease] data-[state=closed]:animate-[nbFadeOut_100ms_ease]",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[10.5px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft",
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

// `hint` is a second line under the entry — what a release is for, under its
// version id (#164). It sits outside ItemText on purpose: only ItemText is
// echoed into the closed trigger, so the hint stays in the open list where there
// is room for it, and the trigger keeps saying just the one thing it has to.
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { hint?: React.ReactNode }
>(({ className, children, hint, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none rounded-[7px] py-1.5 pl-2.5 pr-8 text-[13px] font-[600] text-nb-ink outline-none data-[highlighted]:bg-nb-wash data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      hint ? "flex-col items-start gap-0.5" : "items-center",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    {hint}
    {/* No `top`: the check falls at its static position, which the row layout
        centres and the hint's column layout puts beside the first line. */}
    <span className="absolute right-2.5 flex items-center text-nb-accent-deep">
      <SelectPrimitive.ItemIndicator>
        <FiCheck aria-hidden className="size-[1em]" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-nb-ink/12", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
