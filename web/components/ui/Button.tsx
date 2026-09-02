import type { ReactNode } from "react";

// The page's one button block — the panel's shadow at the panel's offset, so a
// button and a card are cut from the same stock, plus the 2px ink outline the
// panels don't take. That outline is what makes this one a button: a panel is
// lifted, a button is lifted and drawn, and it is the one block on the page you
// are meant to hit. The shadow grows by exactly the hover translate (2px), which
// keeps the block's bottom-right edge pinned as the face lifts off it.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 " +
  "border-border no-underline " +
  "shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 " +
  "hover:-translate-x-0.5 hover:-translate-y-0.5 " +
  "hover:shadow-[6px_6px_0_0_var(--color-ink)] " +
  "active:translate-x-0 active:translate-y-0 " +
  "active:shadow-[2px_2px_0_0_var(--color-ink)]";

// One block, two fills: the primary is the ember with a paper label, the
// secondary the paper with an ink label. Both are outlined in the same ink — in
// every state, hover included — and both cast the same ink shadow. What hover
// moves is the fill, and it moves the way the board's does: the ember settles
// to `accent-deep`, the paper one drops to the wash.
//
// The resting fill is `accent`, the same ember the board's Create task rests on,
// and this is the deliberate exception to the 4.5:1 in design.md: the paper
// label on it measures 4.03:1. It was `accent-deep` at 6.41:1, and the cost of
// those two points was a brick-dark block that made the whole page read heavy —
// the CTA is the largest area of colour on the landing page, so whatever it is
// filled with is the site's mood. There is no brighter ember that clears 4.5:1;
// `accent-deep` is already at that ceiling. The label is bold, the block is
// outlined in ink and shadowed, and it is never the only marker of an action.
// `ink` is the secondary inverted — the same paper block with the fill and the
// label swapped. It exists for the header, where the ember would be a third
// colour in a row that is otherwise ink on paper; reversing the block it stands
// next to makes it the one solid thing in the chrome without adding a hue.
// Hover lifts the fill to `muted` rather than dropping it: ink is already the
// darkest value on the page, so the only move left is up.
const VARIANT = {
  primary: "bg-accent font-bold text-elev hover:bg-accent-deep",
  secondary: "bg-elev font-semibold text-ink hover:bg-code",
  ink: "bg-ink font-bold text-elev hover:bg-muted",
} as const;

// `icon` is `sm` squared up: the same block with no label in it, for the phone
// header, where the button has to earn its width against a logo and a menu. The
// two are the same height on purpose — 36px, the label's `leading-5` box plus
// `py-1.5` against the icon's 16px plus `p-2`, both over the 2px outline — so
// the header is one row tall whether it shows the label or drops it. That is
// what `leading-5` is doing here: without it the line box is the inherited
// `normal` and the block's height drifts with the font.
const SIZE = {
  md: "px-6 py-3",
  sm: "px-3.5 py-1.5 text-[0.95rem] leading-5",
  icon: "p-2",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/**
 * The block on its own, for the one element that has to be this button without
 * being one: the `<summary>` the phone header's menu opens from, which sits
 * beside the GitHub button and would read as a stray glyph next to it. Reach
 * for `<Button>` everywhere else.
 */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}

export type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  const className = buttonClass(variant, size);

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
