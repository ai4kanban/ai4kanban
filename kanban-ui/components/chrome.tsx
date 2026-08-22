// The window chrome's shared pieces — the frame every control in the top row
// wears, and the cluster that holds the ones with no frame of their own.
//
// It is a leaf: nothing here imports another component, so the controls that
// live in the row (Insights, Sessions, Configuration…) can take these without
// importing the header that arranges them.
//
// The row is drawn at IDE weight (see app/design/layouts): every control is a
// 28px box, and what is saved against the old 36px header is the padding around
// them rather than the controls themselves. One frame per cluster, not one per
// control — three machinery buttons a few pixels apart carrying three hard
// shadows read as three objects when they are one.

import { Children, Fragment, isValidElement } from "react";

/** The ink frame and hard shadow every framed control in the row wears. */
export const CHROME = "border-[1.5px] border-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]";

/** The faint ink line that separates without drawing a border — used above a
 *  rail section's label. Between the segments of a control, use SegmentDivider:
 *  the same weight, but it takes the control's own ink. */
export const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";

/** The mark that says an agent is working: a deep-ember dot, breathing. It lives
 *  here rather than beside the first thing that used it because it is now the
 *  board's one word for "running" and it is said in four places — the running
 *  badge and the session log's title bar (agent-shared), the rail's rows and the
 *  card page's subtasks. Wherever a card can be named while an agent is inside
 *  it, this is the dot. The nbPulse keyframe is in globals.css. */
export const PULSE_DOT =
  "size-[7px] shrink-0 rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]";

/** A tool button: 28px wide and the full inner height of the cluster it sits in,
 *  no frame of its own, no press-down. It lives inside a cluster that carries
 *  the frame for all of them, and lifting one out of a shared sticker would be a
 *  button trying to leave its own box.
 *
 *  The height is the cluster's rather than a second 28px: the frame is 28px
 *  including its 1.5px border, so a 28px button inside it overflows by 3px, gets
 *  clipped at the bottom, and leaves every icon sitting a pixel and a half below
 *  the centre of the row. */
export const TOOL_BTN =
  "relative inline-flex h-full w-7 shrink-0 cursor-pointer items-center justify-center text-nb-ink transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] active:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]";

/** The line between two segments of one framed control — the tools in a cluster,
 *  the release chip's picker and its ⋯ menu.
 *
 *  It stops short of the frame at both ends. A rule run edge to edge cuts the
 *  sticker in two and reads as two buttons pushed together; an inset one reads
 *  as one control with a joint in it. And it is drawn in the control's own ink
 *  (`currentColor`), so the sky release chip gets a blue line and the paper tool
 *  cluster a charcoal one, at the same hairline weight in both. */
export function SegmentDivider() {
  // `self-center` rather than the container's alignment: a flex item with a
  // height of its own is put at the top by `items-stretch`, not centred.
  return (
    <span aria-hidden className="mx-0.5 h-[15px] w-px shrink-0 self-center bg-current opacity-[0.16]" />
  );
}

/** The frame a run of TOOL_BTNs shares. The dividers are put in by the cluster
 *  rather than by the buttons, so no tool has to know where in the row it sits —
 *  and the dialogs those tools open (all portalled to <body>) are never in the
 *  DOM here to be given one by mistake. */
export function ToolCluster({ children }: { children: React.ReactNode }) {
  const tools = Children.toArray(children);
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-stretch overflow-hidden rounded-[8px] bg-nb-paper ${CHROME}`}
    >
      {tools.map((tool, i) => (
        <Fragment key={isValidElement(tool) ? tool.key : i}>
          {i > 0 && <SegmentDivider />}
          {tool}
        </Fragment>
      ))}
    </span>
  );
}
