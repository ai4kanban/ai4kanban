// Copied from legacy kanban-ui/components/chrome.tsx; only what the review page uses.

/** The faint ink line that separates without drawing a border. */
export const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";

/** A borderless action, as in the card page's title row. */
export const QUIET =
  "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-2 text-[12px] font-[600] text-nb-ink hover:bg-nb-wash disabled:cursor-not-allowed disabled:opacity-50";
