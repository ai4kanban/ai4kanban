"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The press-down button from the design language: a hard offset shadow that
// grows on hover and collapses on click. `variant` picks the accent fill vs the
// paper ghost; `size` picks the frame scale (default vs compact toolbar). The
// press effects are gated behind `enabled:` so a disabled button sits flat with
// its resting shadow — no lift, no settle.
const button = cva(
  "inline-flex items-center justify-center border-[1.5px] border-nb-ink leading-none cursor-pointer transition-[transform,box-shadow,background-color] duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:active:translate-x-px enabled:active:translate-y-px",
  {
    variants: {
      variant: {
        accent: "bg-nb-accent text-white font-[700] enabled:hover:bg-nb-accent-deep",
        ghost: "bg-nb-paper text-nb-ink font-[600]",
      },
      size: {
        md: "gap-2 rounded-[11px] px-[18px] py-[10px] text-[14px] shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:hover:shadow-[4px_4px_0_0_var(--color-nb-ink)] enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]",
        sm: "gap-1.5 rounded-[9px] px-3 py-2 text-[13px] shadow-[2px_2px_0_0_var(--color-nb-ink)] enabled:hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]",
        // The window chrome's own size (components/chrome.tsx): a 28px box, so a
        // button in the top row lines up with the tool cluster beside it.
        xs: "h-7 gap-1.5 rounded-[8px] px-2.5 text-[12px] shadow-[2px_2px_0_0_var(--color-nb-ink)] enabled:hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]",
      },
    },
    defaultVariants: { variant: "accent", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
