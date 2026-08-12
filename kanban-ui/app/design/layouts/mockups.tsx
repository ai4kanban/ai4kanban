"use client";

import { useState } from "react";
import {
  FiActivity,
  FiChevronDown,
  FiColumns,
  FiEdit2,
  FiFeather,
  FiFolder,
  FiMoreHorizontal,
  FiPlay,
  FiPlus,
  FiSettings,
  FiTag,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import { TbNorthStar } from "react-icons/tb";
import { LogoMark } from "@/components/Logo";

// The page body — see page.tsx for what this page is and what the layout below
// has agreed to before it starts.

// ── the stand-in board ───────────────────────────────────────────────────────

const OPEN = [
  { id: 171, title: "Make a board from the UI, with no command to type" },
  { id: 184, title: "Mark the npm board UI deprecated on the registry" },
];

// ── the chrome, at IDE weight ────────────────────────────────────────────────
//
// Shorter than the header the board ships today — 44px against 60 — but not
// thinner: every control is a 28px box, the project selector keeps the pill it
// has at 26, and what is saved is the padding around them rather than the
// controls themselves. What organises the row is one frame per cluster, not one per
// control: the three machinery buttons share a single sticker with hairlines
// between them instead of carrying three hard shadows a few pixels apart.
// Nothing else in the row is divided — identity on the left, controls on the
// right, and an 8px gap between them is the whole of the punctuation.
//
// Every control is 28px so one alignment rule holds for the whole row. Padding is
// 7 above and 8 below: a sticker's shadow falls 2px past its box while the
// badge and Goal have none, so the extra pixel splits the difference and both
// kinds land within half a pixel of the row's centre.

const CHROME = "border-[1.5px] border-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]";

const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";

// The top row and the rail have no surface of their own: they sit on the
// window's cream, which is what makes them one L-shaped chrome rather than two
// regions that each need an edge drawn to say where they stop. The only surface
// in the window is the body's paper.

/** Which board this is, and the way to another one — the header's own badge,
 *  unchanged: folder mark, the whole path in mono, a soft pill. It is the one
 *  thing here that is read rather than pressed, so it keeps the quiet frame
 *  instead of taking a sticker — and sits 2px shorter than the controls, which
 *  is enough to put it a step behind them without breaking the row. */
const ProjectBadge = () => (
  <span
    className="inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-nb-ink-soft"
    style={{
      background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
      border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
    }}
  >
    <FiFolder className="shrink-0 opacity-70" size={12} />
    <span className="truncate">/Users/wutao/git/ai4kanban</span>
  </span>
);

/** What the board is for. A compass alone said "navigate" and nothing about the
 *  goal, so it is a north star with the word beside it, on the board's ordinary
 *  button — ink frame and hard shadow, the same object as every other control
 *  in the row. */
const GoalBtn = () => (
  <span
    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-nb-paper px-2.5 text-[12px] font-[700] text-nb-ink ${CHROME}`}
  >
    <TbNorthStar size={15} />
    Goal
  </span>
);

/** A ghost icon button — no frame of its own; it lives inside a cluster that
 *  has one. 28px wide, and as tall as the cluster's inside rather than 28px
 *  again: the frame is 28px including its border, so a 28px button in it hangs
 *  3px past the bottom and every icon sits low in the row. */
const GhostBtn = ({ icon: Icon }: { icon: typeof FiSettings }) => (
  <span className="inline-flex h-full w-7 items-center justify-center text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]">
    <Icon size={15} />
  </span>
);

/** The joint between two segments of one control. It stops short of the frame at
 *  both ends: a rule run edge to edge cuts the sticker in two and reads as two
 *  buttons pushed together, where an inset one reads as one control with a joint
 *  in it. Drawn in the control's own ink, so a tinted chip's joint is tinted. */
const Joint = () => (
  <span aria-hidden className="mx-0.5 h-[15px] w-px self-center bg-current opacity-[0.16]" />
);

/** Runs, progress and settings in one frame. They are all "look at the board's
 *  machinery" and none of them is a primary action, so they get one sticker
 *  between them and joints instead of gaps. */
const Tools = () => (
  <span className={`inline-flex h-7 items-stretch overflow-hidden rounded-[8px] bg-nb-paper ${CHROME}`}>
    <GhostBtn icon={FiTrendingUp} />
    <Joint />
    <GhostBtn icon={FiActivity} />
    <Joint />
    <GhostBtn icon={FiSettings} />
  </span>
);

/** Which release the board is showing, and the ⋯ that ends it — two segments in
 *  one sticker, joined the same way the tools are. Both are the chip's sky ink:
 *  the ⋯ was ember once, to keep the one place a release ends from being the
 *  thing nobody sees, but ember on a sky wash is the one pairing in the palette
 *  that fights, and it made a menu of ordinary verbs look like a warning. The
 *  joint and the wash under the pointer are what tell the halves apart. */
const Release = () => (
  <span
    className={`inline-flex h-7 shrink-0 items-center rounded-[8px] p-0.5 text-[12px] font-[700] ${CHROME}`}
    style={{ background: "var(--color-nb-sky-soft)", color: "var(--color-nb-sky-ink)" }}
  >
    <span className="inline-flex h-full items-center gap-1.5 rounded-[6px] px-1.5">
      <FiTag size={13} />
      0.6.0 (14)
      <FiChevronDown size={12} />
    </span>
    <Joint />
    <span className="inline-flex h-full items-center rounded-[6px] px-1">
      <FiMoreHorizontal size={14} />
    </span>
  </span>
);

const CreateTask = () => (
  <span
    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-[700] text-white ${CHROME}`}
    style={{ background: "var(--color-nb-accent)" }}
  >
    <FiPlus size={15} />
    Create task
  </span>
);

/** The whole top row: which board on the left, what to do with it on the right.
 *  The left is only identity — the mark and the folder — so everything you can
 *  press, Goal included, is on one side and the eye has one place to go. */
function Chrome() {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <LogoMark className="size-[22px] rounded-[6px]" />
        <ProjectBadge />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GoalBtn />
        <Release />
        <Tools />
        <CreateTask />
      </div>
    </div>
  );
}

// ── the rail ────────────────────────────────────────────────────────────────

// Wide enough that a title says something before it truncates, and rows tall
// enough to be aimed at with a trackpad: 216 × 30, against the 188 × 26 that
// read as a preference pane rather than as a list of open work.
const RAIL_W = 216;

function RailRow({
  label,
  id,
  count,
  active,
  closeable = false,
  onClick,
}: {
  label: string;
  id?: number;
  count?: number;
  active: boolean;
  closeable?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`group relative flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-[8px] pl-2.5 pr-2 text-left text-[12.5px] ${
        active
          ? "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]"
          : "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
      }`}
    >
      {id === undefined ? (
        <FiColumns size={13} className="shrink-0" />
      ) : (
        <span
          className="shrink-0 font-mono text-[11px] tabular-nums"
          style={{ color: active ? "var(--color-nb-accent)" : "inherit", opacity: active ? 1 : 0.6 }}
        >
          {id}
        </span>
      )}
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">{count}</span>
      )}
      {closeable && (
        <FiX
          size={13}
          className={`ml-auto shrink-0 opacity-0 group-hover:opacity-60 ${active ? "opacity-40" : ""}`}
        />
      )}
    </button>
  );
}

/** A rail section title: 10px, upper, and carrying the count on the same line
 *  so the label row is never spent on the label alone. The hairline above it is
 *  what separates the board from the cards opened off it. */
const RailLabel = ({ text, count }: { text: string; count: number }) => (
  <div
    className="mb-1 mt-2.5 flex items-center justify-between px-2.5 pb-1.5 pt-2.5"
    style={{ borderTop: `1px solid ${HAIRLINE}` }}
  >
    <span className="text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">{text}</span>
    <span className="font-mono text-[10.5px] tabular-nums text-nb-ink-soft opacity-70">{count}</span>
  </div>
);

function Rail({ active, onPick }: { active: number; onPick: (i: number) => void }) {
  return (
    <nav className="flex shrink-0 flex-col gap-0.5 p-2" style={{ width: RAIL_W }}>
      <RailRow label="All cards" count={32} active={active === 0} onClick={() => onPick(0)} />
      <RailLabel text="Open cards" count={OPEN.length} />
      {OPEN.map((c, i) => (
        <RailRow key={c.id} id={c.id} label={c.title} active={active === i + 1} closeable onClick={() => onPick(i + 1)} />
      ))}
    </nav>
  );
}

// ── the stand-in body ───────────────────────────────────────────────────────

const CardBlock = () => (
  <div className="h-[92px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper shadow-[2px_2px_0_0_var(--color-nb-ink)]" />
);

// ── the column: a header band, and nothing else ─────────────────────────────
//
// The board's paper panel already is a surface. A wash panel per column on top
// of it was a box inside a box — two radii, two edges, and a framed card sitting
// third. So the wash shrinks to the header: a chip the width of the column,
// carrying the name, the count and the column's colour, with the cards on the
// window's paper below it. That is all the fill was ever doing.
//
// Losing the fill costs the column its edges, so the gutter pays for them: 32px
// instead of 16, or two 2-up grids side by side read as one 4-up grid.
//
// components/Queue.tsx ships this.

// Real widths are 560 / 560 / 300; drawn at 460 / 460 / 460 here because
// Recurring is 2-up now like the others, and because the row is meant to run
// off the right edge — the board scrolls sideways and a mockup that fits
// everything hides the one thing the gutter has to survive.
const STUB_COLUMNS: {
  title: string;
  count: string;
  w: number;
  lilac?: boolean;
  bands: { title: string | null; n: number }[];
}[] = [
  {
    title: "Ready to build",
    count: "4 ready · 1 implementing",
    w: 460,
    bands: [
      { title: "Features", n: 4 },
      { title: "Skill", n: 2 },
    ],
  },
  {
    title: "Not ready",
    count: "10",
    w: 460,
    bands: [
      { title: "Features", n: 4 },
      { title: "Infra", n: 2 },
    ],
  },
  // Recurring has no tracks on the real board — it is one list — so it is one
  // unnamed band. Drawn 2-up here, which costs it the narrow width that used to
  // say "this is a list you glance at", so the band is the whole of what marks
  // it: the lilac cast, and a lilac bullet to match. On the shipped board it is
  // still 300px and one card across.
  { title: "Recurring", count: "4", w: 460, lilac: true, bands: [{ title: null, n: 4 }] },
];

const LILAC_FILL = "color-mix(in srgb, var(--color-nb-lilac) 16%, var(--color-nb-wash))";

function BoardStub() {
  return (
    <div className="flex h-full items-stretch gap-8 overflow-hidden p-4">
      {STUB_COLUMNS.map((col) => (
        <StubColumn key={col.title} {...col} />
      ))}
    </div>
  );
}

function StubColumn({ title, count, w, lilac, bands }: (typeof STUB_COLUMNS)[number]) {
  return (
    <section className="flex shrink-0 flex-col overflow-hidden" style={{ width: w }}>
      <div
        className="mb-3 flex h-8 shrink-0 items-center justify-between gap-3 rounded-[10px] px-2.5"
        style={{ background: lilac ? LILAC_FILL : "var(--color-nb-wash)" }}
      >
        <h3 className="nb-tag">
          <span style={{ color: lilac ? "var(--color-nb-lilac-ink)" : "var(--color-nb-accent)" }}>●</span>
          {title}
        </h3>
        <span className="shrink-0 text-[12px] text-nb-ink-soft">{count}</span>
      </div>
      <div className="flex min-h-0 flex-col gap-2">
        {bands.map((band, i) => (
          <StubBand key={band.title ?? i} title={band.title} n={band.n} />
        ))}
      </div>
    </section>
  );
}

/** A track inside a column — the rule, the name, the count, then two cards
 *  across. Unchanged from the board; it is here so the header band is judged
 *  against the lines it actually sits above. */
function StubBand({ title, n }: { title: string | null; n: number }) {
  return (
    <section className="px-2 pb-3 pt-2">
      {title && (
        <div className="mb-2.5 flex items-center gap-2.5">
          <h4 className="nb-tag whitespace-nowrap text-[10.5px]">{title}</h4>
          <span aria-hidden className="h-px flex-1" style={{ background: HAIRLINE }} />
          <span className="text-[11px] tabular-nums text-nb-ink-soft">{n}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: n }, (_, i) => (
          <CardBlock key={i} />
        ))}
      </div>
    </section>
  );
}

const CARD_BUTTONS: { label: string; icon: typeof FiPlay }[] = [
  { label: "Implement", icon: FiPlay },
  { label: "Refine", icon: FiFeather },
  { label: "Edit", icon: FiEdit2 },
];

/** A card page, as the body beside the rail. No frame and no surface of its own
 *  — it fills the paper panel, and the change from the chrome's cream says where
 *  the body starts as well as a line would. */
function CardStub({ card }: { card: (typeof OPEN)[number] }) {
  return (
    <div className="h-full overflow-hidden px-6 py-5">
      <div className="mx-auto w-full max-w-[840px]">
        <div className="mb-4 flex items-baseline gap-2.5">
          <span className="text-[20px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
            #{card.id}
          </span>
          <h2 className="text-[20px] font-[800] tracking-[-0.02em]">{card.title}</h2>
        </div>
        <div className="mb-4 flex items-center gap-2">
          {CARD_BUTTONS.map(({ label, icon: Icon }, i) => (
            <span
              key={label}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-[700] ${CHROME} ${
                i === 0 ? "text-white" : "bg-nb-paper text-nb-ink"
              }`}
              style={i === 0 ? { background: "var(--color-nb-accent)" } : undefined}
            >
              <Icon size={14} />
              {label}
            </span>
          ))}
        </div>
        <div className="mb-4 h-[64px] rounded-[13px] border-[1.5px] border-nb-ink bg-nb-wash" />
        <div className="flex flex-col gap-2">
          {[100, 96, 88, 92, 60].map((w, i) => (
            <div
              key={i}
              className="h-[10px] rounded-full"
              style={{ width: `${w}%`, background: "color-mix(in srgb, var(--color-nb-ink) 10%, transparent)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── the window ──────────────────────────────────────────────────────────────

/** The rail layout, drawn in the app's own default window: 1280 × 560, no URL
 *  bar and no back button, which is the whole reason this page exists. */
function RailWindow() {
  const [tab, setTab] = useState(0);
  return (
    <div className="overflow-x-auto">
      {/* The cream goes on as a style, not as bg-nb-cream: .nb-panel sets a
          paper background of its own and wins, which would leave the chrome and
          the rail the same white as the body they are supposed to sit behind. */}
      <div
        className="nb-panel flex h-[560px] w-[1280px] flex-col overflow-hidden rounded-[14px]"
        style={{ background: "var(--color-nb-cream)" }}
      >
        <Chrome />
        <div className="flex min-h-0 flex-1">
          <Rail active={tab} onPick={setTab} />
          {/* Cream on the two sides the chrome is on — 16px each, half of it
              the rail's and the top row's own padding — and none on the two the
              window is on: the body runs into the bottom and right edges, where
              the window's own radius does the rounding. That leaves one corner
              for the body to round itself, top-left, the one where it turns
              away from the chrome. The paper lives here rather than in either
              body, so the board and a card page are the same surface. */}
          <div className="min-w-0 flex-1 pl-2">
            <div className="h-full overflow-hidden rounded-tl-[14px] bg-nb-paper">
              {tab === 0 ? <BoardStub /> : <CardStub card={OPEN[tab - 1]} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the page ────────────────────────────────────────────────────────────────

const NOTES = [
  ["Chrome", "44px against the 60 the board ships: one row, every control a 28px box — the project pill 26, since it is read rather than pressed — and the saving taken out of the padding rather than out of the controls. The wordmark is gone — the mark says the product, the badge says the board."],
  ["Sides", "The left is identity and nothing else — the mark, then the board it names. Everything pressable is on the right, Goal at its head, so there is one place to look for a control, and no divider is needed to say which is which."],
  ["Tools", "Runs, progress and settings share one frame with hairlines between them — one shadow for the cluster, not three sitting a few pixels apart."],
  ["Alignment", "7px above, 8px below. A sticker's shadow falls 2px past its box and the badge has none, so the odd pixel splits the difference and both land within half a pixel of centre."],
  ["No lines", "Nothing in the window is separated by a border. The top row and the rail sit straight on the window's cream and read as a single L, and the body says where it starts by being paper instead — the same panel for the board as for a card page, so only the contents change when you switch."],
  ["Gutter", "16px of that cream down the two sides the chrome is on, half of it the chrome's own padding. The other two sides get none: the body runs into the window and takes the window's corners, so the only radius it draws is the top-left one, where it turns away from the chrome."],
  ["Rail", "216 × 30 rows, and the count rides on the section label so no row is spent on a label alone."],
  ["Selection", "The open row is paper with an inset ink outline — no hard shadow, which at row height would read as a lifted button rather than as where you are."],
  ["Column", "A header band and nothing else: a 32px wash chip the width of the column, cards on the paper below it. The panel it replaces was a box inside the body's panel with a framed card inside that — three edges for two levels of meaning. Shipped in components/Queue.tsx."],
  ["Gutter", "32px between columns, twice the panel's 16. Without a fill, the gap is the only thing keeping two 2-up grids from reading as one 4-up grid."],
  ["Recurring", "The band is now the whole of what marks it, so the lilac cast moved there and the bullet went lilac with it — an ember dot on a lilac band is the one warm thing in the column and reads as a warning. Drawn 2-up here; the shipped column is still 300px and one across."],
];

export function Layouts() {
  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-6 py-10">
      <header className="max-w-[800px]">
        <h1 className="text-[30px] font-[800] tracking-[-0.03em]">Window layout — a rail of open cards</h1>
        <p className="mt-3 text-[15px] leading-relaxed">
          A desktop window has no back gesture and no back button, so opening a card has to leave
          something on screen that is also the way out of it. That something is a rail down the
          left: <strong className="font-[700]">All cards</strong> at the top — the board, never
          closeable — then every open card as a row you can close. Closing the last one lands back
          on All cards; with nothing open the rail is one row.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-nb-ink-soft">
          The rail costs width on a board that already scrolls sideways, so the chrome is drawn at
          IDE weight to give some of it back: a 44px top row instead of 60, 28px controls instead
          of 36, and one frame per cluster instead of one per control. No region draws an edge and
          the row has no dividers: the top row and the rail share one
          cream and read as a single L, and the body is told apart by surface and by the 16px of
          cream around it rather than by a line. Rows are live — click one and the body changes.
          The frame is
          1280 × 560, the app&rsquo;s own default window; the
          board columns are drawn a little narrower than life (460 against 560), two cards across
          in each, and the row runs off the right edge the way it does on the board.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-nb-ink-soft">
          The column comes with it. The body is already a paper panel, so a wash panel per column
          was a box inside a box, with a framed card inside that. The wash is now the header alone
          — a chip the width of the column, carrying its name, its count and its colour — and the
          cards sit on the paper. The gutter goes to 32px to pay for the edges the fill used to
          draw.
        </p>
      </header>

      <RailWindow />

      <ul className="flex max-w-[900px] flex-col gap-2 text-[13.5px] leading-relaxed text-nb-ink-soft">
        {NOTES.map(([title, body]) => (
          <li key={title} className="flex gap-2">
            <span aria-hidden style={{ color: "var(--color-nb-accent)" }}>
              ●
            </span>
            <span>
              <strong className="font-[700] text-nb-ink">{title}</strong> — {body}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
