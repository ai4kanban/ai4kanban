import type { ReactNode } from "react";

// The page's one button block — the panel's shadow at the panel's offset, so a
// button and a card are cut from the same stock. The shadow grows by exactly the
// hover translate (2px), which keeps the block's bottom-right edge pinned as the
// face lifts off it.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 " +
  "border-border font-semibold no-underline " +
  "shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 " +
  "hover:-translate-x-0.5 hover:-translate-y-0.5 " +
  "hover:shadow-[6px_6px_0_0_var(--color-ink)] " +
  "active:translate-x-0 active:translate-y-0 " +
  "active:shadow-[2px_2px_0_0_var(--color-ink)]";

// One block, two fills: the primary is the deep blue with a paper label, the
// secondary the paper with an ink label. Both are outlined in the same ink — in
// every state, hover included — and both cast the same ink shadow. What hover
// moves is the fill: the primary brightens to the azure it is a deep cut of, the
// paper one drops to the wash. That is the one moment the bright azure is a
// ground, and nothing sits on it that isn't paper-white.
//
// The primary fill is `accent-deep`, not `accent`, and /design is where that was
// settled rather than argued: `accent` carries a paper label at only 3.84:1,
// under the 4.5:1 a button label needs. `accent-deep` is 7.28:1 from the page
// and carries the paper label at 7.87:1.
const VARIANT = {
  primary: "bg-accent-deep text-elev hover:bg-accent",
  secondary: "bg-elev text-ink hover:bg-code",
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
  /** Saves `href` to disk instead of navigating — the recipe card downloads. */
  download?: boolean;
  /** Only reachable from a client component — the copy CTA is the one caller. */
  onClick?: () => void;
  "aria-label"?: string;
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  href,
  download,
  onClick,
  ...rest
}: ButtonProps) {
  const className = `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;

  if (href) {
    // Every off-site link on this page is a plain <a> — see the eslint config.
    return (
      <a
        href={href}
        download={download}
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
