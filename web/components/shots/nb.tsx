import type { CSSProperties, ReactNode } from "react";

// Hand-drawn stand-ins for the local board UI (kanban-ui/), used as the artwork
// in the 持续推进 section. They are NOT screenshots and NOT interactive: every
// value below was copied by hand out of the real components, so a change over in
// kanban-ui/ makes these quietly wrong. Each shot file names the component it
// mirrors — reread that file when the board's look moves.
//
// Why drawn rather than captured. The Loop hands a shot ~475px of width (half
// of max-w-6xl, minus the gap and the mat's padding). A real capture of the card
// page is 840px wide, so it lands there at ~0.5× and little can be read. These
// are sized in `em` off a single root font-size, and that root is
// container-relative (`cqw`), so the drawing scales to whatever width it is
// given and the type holds its proportion at every one. Tailwind's utilities are
// px throughout, which is the one thing that can't work here — hence the inline
// style objects.

/** kanban-ui/app/globals.css `@theme`, copied 1:1. */
export const NB = {
  ink: "#24231f",
  inkSoft: "#565550",
  cream: "#f7f7f4",
  canvas: "#efeeeb",
  paper: "#ffffff",
  /** A card page's sections — the cream family, a rung lighter than the page. */
  sheet: "#fbfaf7",
  wash: "#f4f3ef",
  accent: "#dd4f1e",
  accentDeep: "#b83a12",
  accentSoft: "#f7ddce",
  /** Section grounds: a signal thinned until a whole block of one can carry body
   *  text. A card page spends colour on two sections and no more — ember where an
   *  answer is wanted, mint where the work is already done. */
  accentWash: "#fbf0e9",
  mintWash: "#eff8f2",
  mint: "#7fca9c",
  mintSoft: "#e4f3ea",
  mintInk: "#2f6b46",
  sky: "#7fb4e0",
  skySoft: "#e6f1fb",
  skyInk: "#2c5c86",
  lilac: "#b199e0",
  lilacSoft: "#efe9fb",
  lilacInk: "#5a3f92",
  peach: "#ec9a72",
  peachSoft: "#fbe9dd",
  peachInk: "#8a4a28",
} as const;

const SANS =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** The real card body's text size — the unit every length here is written in. */
const BASE = 14;

/** px → em. `own` is the font-size of the element the length sits on, since a
 *  padding/width in `em` resolves against that element's own size, not the root. */
export const em = (px: number, own: number = BASE) =>
  `${Number((px / own).toFixed(4))}em`;

// The root type size as a share of the container's width. Not the real card's
// 14px body scaled down — the type is sized to the SLOT, so a title, a meta row
// and a chip line each fit on one line the way they do on a full-width board.
// At the real card's proportion everything broke a word or two early, and four
// shots of ragged two-line headings is what made the section look unsettled.
// `max()` and not `clamp()`: the floor keeps a phone-width mat legible, and
// nothing wants a ceiling — capping the type would only shrink the drawing
// inside a wider slot.
const ROOT = `max(0.5rem, 2.1cqw)`;

/** How much of the crop box the fade covers, bottom-up. */
const FADE = "30%";

/** The shape all three shots are cut to. A card page is far taller than the
 *  Loop's column is wide, so each one is cropped rather than shown whole — and
 *  they're cropped to ONE ratio so the four steps read as a set. 1.5 is about
 *  half of the tallest shot (the ready card, which is why it wanted cutting);
 *  on the other two it lands lower, because halving them would take away the
 *  open questions and the shipped-files list they exist to show. */
export const CROP = 1.5;

/** The frame every shot sits in: establishes the container the `cqw` above
 *  measures, and sets the one font-size everything inside is relative to. Its
 *  ground is paper, not cream — kanban-ui's `Window.tsx` draws the body pane in
 *  paper and keeps cream for the chrome around it, and these shots are of the
 *  body. */
export function Shot({
  children,
  crop,
  style,
}: {
  children: ReactNode;
  /** Cut the drawing to this width∶height and dissolve the cut edge into the
   *  canvas, so it reads as a page carrying on below rather than a short one.
   *  Because the type is a fixed share of the width, the layout is the same
   *  at every size — so one ratio crops to the same point at any width, and
   *  each shot's is just its natural aspect with the height halved. */
  crop?: number;
  style?: CSSProperties;
}) {
  const inner = (
    <div
      style={{
        fontSize: ROOT,
        fontFamily: SANS,
        lineHeight: 1.45,
        color: NB.ink,
        background: NB.paper,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  );

  return (
    <div style={{ containerType: "inline-size", ...style }}>
      {crop ? (
        <div
          style={{
            position: "relative",
            aspectRatio: String(crop),
            overflow: "hidden",
            background: NB.paper,
          }}
        >
          {inner}
          {/* Fades into the drawing's own canvas rather than to transparent:
              the mat behind carries a texture, and dissolving onto that would
              leave the frame's bottom border floating over open artwork. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              height: FADE,
              background: `linear-gradient(to bottom, transparent, ${NB.paper})`,
            }}
          />
        </div>
      ) : (
        inner
      )}
    </div>
  );
}

/** The hairline every quiet rule on the board is drawn at — `nb-ink/12`. An ink
 *  1.5px frame is now reserved for the two things that are still objects: a
 *  dialog, and a button. */
export const HAIR = "color-mix(in srgb, #24231f 12%, transparent)";

/** `.nb-panel` — ink-framed paper block with the hard offset shadow. The one
 *  frame left in the board: a dialog floating over the page. */
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        border: `${em(1.5)} solid ${NB.ink}`,
        borderRadius: em(16),
        background: NB.paper,
        boxShadow: `${em(3)} ${em(3)} 0 0 ${NB.ink}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** `.nb-section` — the shape every block on a card page takes: no frame and no
 *  shadow, told from the page by its ground alone. `sheet` unless the block
 *  MEANS something, and then `NB.accentWash` / `NB.mintWash`. */
export function Section({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ borderRadius: em(14), background: NB.sheet, ...style }}
    >
      {children}
    </div>
  );
}

/** `.nb-inset` — the same shape at hairline weight, for a window inside a
 *  dialog: the run log's frame in the runs panel. */
export function Inset({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${HAIR}`,
        borderRadius: em(14),
        background: NB.paper,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** `.nb-tag` — the borderless section kicker. */
export function Tag({
  children,
  mark,
}: {
  children: ReactNode;
  /** The coloured glyph that leads the kicker (`●`, `?`). */
  mark?: ReactNode;
}) {
  const F = 11;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: em(8, F),
        fontSize: em(F),
        fontWeight: 700,
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
        color: NB.ink,
      }}
    >
      {mark}
      {children}
    </span>
  );
}

/** The meta band's micro-caption (CardPage's `CAP`). */
export function Cap({ children }: { children: ReactNode }) {
  const F = 10;
  return (
    <span
      style={{
        fontSize: em(F),
        fontWeight: 700,
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: NB.inkSoft,
      }}
    >
      {children}
    </span>
  );
}

/** `.nb-chip` — the borderless meaning pill. `icon`/`chevron` are the 11px marks
 *  the real chips and the dressed-down selects carry. */
export function Chip({
  bg,
  ink,
  icon,
  chevron,
  children,
}: {
  bg: string;
  ink: string;
  icon?: ReactNode;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const F = 10;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: em(4, F),
        borderRadius: em(6, F),
        padding: `${em(2.5, F)} ${em(6, F)}`,
        fontSize: em(F),
        fontWeight: 700,
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        background: bg,
        color: ink,
      }}
    >
      {icon}
      {children}
      {chevron && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          style={{
            width: em(10, F),
            height: em(10, F),
            flex: "0 0 auto",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </span>
  );
}

/** The 10px icon a chip carries, sized against the chip's own type. */
export function ChipIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: "flex",
        width: em(10, 10),
        height: em(10, 10),
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  );
}

/** components/button.tsx at `size="sm"` — the card page's whole toolbar. Drawn
 *  in its resting state only; the press-down lift is an interaction these have
 *  no business having. */
export function Btn({
  variant = "ghost",
  icon,
  ink,
  children,
  style,
}: {
  variant?: "accent" | "ghost";
  icon?: ReactNode;
  /** Overrides border + text, for Reject's ember ghost. */
  ink?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const F = 13;
  const accent = variant === "accent";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: em(6, F),
        borderRadius: em(9, F),
        padding: `${em(8, F)} ${em(12, F)}`,
        border: `${em(1.5, F)} solid ${ink ?? NB.ink}`,
        boxShadow: `${em(2, F)} ${em(2, F)} 0 0 ${NB.ink}`,
        fontSize: em(F),
        fontWeight: accent ? 700 : 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        background: accent ? NB.accent : NB.paper,
        color: accent ? "#fff" : (ink ?? NB.ink),
        ...style,
      }}
    >
      {icon && (
        <span
          aria-hidden
          style={{
            display: "flex",
            width: em(15, F),
            height: em(15, F),
            flex: "0 0 auto",
          }}
        >
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** One meta column: caption stacked over its value (CardPage's `MetaItem`). */
export function MetaItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: em(4) }}>
      <Cap>{label}</Cap>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: em(6),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** chips.tsx `TodoProgress` — the thin bar plus its count. */
export function Todos({
  done,
  total,
  width = 90,
}: {
  done: number;
  total: number;
  width?: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: em(6) }}>
      <span
        style={{
          display: "block",
          width: em(width),
          height: em(4),
          borderRadius: em(999),
          overflow: "hidden",
          background: "color-mix(in srgb, #24231f 12%, transparent)",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: done >= total && total > 0 ? NB.mint : NB.accent,
          }}
        />
      </span>
      <span
        style={{
          fontSize: em(10.5),
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: NB.inkSoft,
        }}
      >
        {done}/{total}
      </span>
    </span>
  );
}

/** The `#nn` reference pill the card page uses for related / blocked-by cards. */
export function IdChip({ id, bg = NB.wash, ink = NB.inkSoft }: { id: number; bg?: string; ink?: string }) {
  return (
    <Chip bg={bg} ink={ink}>
      #{id}
    </Chip>
  );
}

/** Inline `<code>` as markdown.css renders it inside a card body. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: MONO,
        fontSize: "0.9em",
        background: NB.wash,
        border: `1px solid color-mix(in srgb, #24231f 16%, transparent)`,
        borderRadius: em(5, 12.6),
        padding: `${em(1, 12.6)} ${em(6, 12.6)}`,
        // `.nb-md`'s own rule — a long path or command breaks rather than
        // punching out through the side of the panel.
        overflowWrap: "break-word",
      }}
    >
      {children}
    </code>
  );
}

/** The run log's title bar — the kicker, the outcome glyph, and the run's facts
 *  in one middot row. `agent-shared.tsx`'s `titleBar`, resting state. Chrome over
 *  the well below it, parted by a hairline; it carries no fill of its own, so it
 *  sits on whatever ground the frame around it has.
 *
 *  A live run swaps the ✓ for a pulse and puts Stop beside it — both come in
 *  from the shot, since the pulse is that drawing's own animation. */
export function LogBar({
  facts,
  tool,
  mark,
}: {
  facts: string[];
  /** The control that rides the bar — Stop, while the run is live. */
  tool?: ReactNode;
  mark?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(10),
        minHeight: em(22),
        padding: `${em(10)} ${em(16)}`,
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      <Tag>run log</Tag>
      <span
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: em(6),
        }}
      >
        {tool}
        {mark ?? (
          <span aria-hidden style={{ color: NB.accentDeep, fontSize: em(12) }}>
            ✓
          </span>
        )}
        <span style={{ fontSize: em(11), color: NB.inkSoft }}>
          {facts.map((f, i) => (
            <span
              key={f}
              style={i > 0 ? { fontVariantNumeric: "tabular-nums", opacity: 0.8 } : undefined}
            >
              {i > 0 && (
                <span aria-hidden style={{ margin: `0 ${em(6, 11)}` }}>
                  ·
                </span>
              )}
              {f}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

export { MONO, SANS };
