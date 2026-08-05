import type { ReactNode } from "react";

// The page's one button block. Same soft-brutalist idea as the panel, but a
// smaller offset — a button is a control, not a card, so the shadow reads as a
// lip rather than a slab. The shadow grows by exactly the hover translate (2px),
// which keeps the block's bottom-right edge pinned as the face lifts off it.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 " +
  "font-semibold no-underline transition-all duration-150 " +
  "hover:-translate-x-0.5 hover:-translate-y-0.5 " +
  "active:translate-x-0 active:translate-y-0";

const VARIANT = {
  primary:
    "border-accent bg-accent text-white shadow-[2px_2px_0_0_#1f6feb] " +
    "hover:shadow-[4px_4px_0_0_#1f6feb] active:shadow-[2px_2px_0_0_#1f6feb]",
  secondary:
    "border-border text-ink shadow-[2px_2px_0_0_#010409] hover:border-accent/50 " +
    "hover:shadow-[4px_4px_0_0_var(--color-accent)] active:shadow-[2px_2px_0_0_#010409]",
} as const;

const SIZE = {
  md: "px-6 py-3",
  sm: "px-3.5 py-1.5 text-[0.95rem]",
} as const;

export type ButtonProps = {
  children: ReactNode;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  /** Set to render a link. Without it you get a `<button>`. */
  href?: string;
  /** Only reachable from a client component — the copy CTA is the one caller. */
  onClick?: () => void;
  "aria-label"?: string;
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  href,
  onClick,
  ...rest
}: ButtonProps) {
  const className = `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;

  if (href) {
    // Every off-site link on this page is a plain <a> — see the eslint config.
    return (
      <a
        href={href}
        rel={href.startsWith("http") ? "noopener" : undefined}
        className={className}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} cursor-pointer`}
      {...rest}
    >
      {children}
    </button>
  );
}
