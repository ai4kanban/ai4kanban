import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "./utils";

// shadcn's Button in the press-down language of ../button.tsx: `accent` and `outline` carry the
// ink frame and hard shadow; `ghost` and `link` are the quiet in-line controls.
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-[600] leading-none transition-[transform,box-shadow,background-color] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        accent: "border-[1.5px] border-nb-ink bg-nb-accent font-[700] text-white shadow-[2px_2px_0_0_var(--color-nb-ink)] enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:hover:bg-nb-accent-deep enabled:hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:active:translate-x-px enabled:active:translate-y-px enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]",
        outline: "border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)] enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] enabled:active:translate-x-px enabled:active:translate-y-px enabled:active:shadow-[1px_1px_0_0_var(--color-nb-ink)]",
        ghost: "text-nb-ink enabled:hover:bg-nb-ink/[0.06] aria-expanded:bg-nb-ink/[0.06]",
        link: "text-nb-accent-deep enabled:hover:underline",
      },
      size: {
        md: "rounded-[9px] px-3 py-2 text-[13px]",
        sm: "h-7 rounded-[8px] px-2 text-[13px]",
        icon: "size-6 rounded-[6px]",
        inline: "p-0 text-[12.5px]",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" type="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
