// The window chrome's shared pieces — the frame every control in the top row
// wears, and the cluster that holds the ones with no frame of their own.
//
// It is a leaf: nothing here imports another component, so the controls that
// live in the row (Progress, Sessions, Configuration…) can take these without
// importing the header that arranges them.
//
// The row is drawn at IDE weight (see app/design/layouts): every control is a
// 28px box, and what is saved against the old 36px header is the padding around
// them rather than the controls themselves. One frame per cluster, not one per
// control — three machinery buttons a few pixels apart carrying three hard
// shadows read as three objects when they are one.

/** The ink frame and hard shadow every framed control in the row wears. */
export const CHROME = "border-[1.5px] border-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]";

/** The faint ink line that separates without drawing a border — used between the
 *  tools in a cluster, and above a rail section's label. */
export const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";

/** A tool button: 28px square, no frame of its own, no press-down. It lives
 *  inside a cluster that carries the frame for all of them, and lifting one out
 *  of a shared sticker would be a button trying to leave its own box. */
export const TOOL_BTN =
  "relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-nb-ink transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] active:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]";

/** The frame a run of TOOL_BTNs shares. The hairline is put on by the cluster
 *  rather than by the buttons, so no tool has to know where in the row it sits —
 *  and the dialogs those tools open (all portalled to <body>) are never in the
 *  DOM here to be given one by mistake. */
export function ToolCluster({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-stretch overflow-hidden rounded-[8px] bg-nb-paper [&>button:not(:first-child)]:border-l [&>button:not(:first-child)]:border-l-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)] ${CHROME}`}
    >
      {children}
    </span>
  );
}
