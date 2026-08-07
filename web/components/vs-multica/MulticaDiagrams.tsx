import type { ReactNode } from "react";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// The two hero diagrams, drawn the way `HkDiagrams.tsx` draws the Hermes pair:
// one viewBox, one set of margins, one canvas, so the two read as two views of
// the same subject rather than as two unrelated pictures.
//
// Here the shared subject is *you*. The same person glyph stands at the left of
// both drawings, at the same size and the same height, because the argument is
// not who starts the work — you do, on both sides — but what you are handed
// after that. Ours: one agent that plans against the project's memory and works
// the board for you. Theirs: a fleet you configure with skills and runtimes,
// then dispatch and watch.
//
// Each diagram fills exactly one block — ours the azure agent, theirs the ink
// console — and that block is the product itself. Everything else is neutral,
// including the person, who belongs to neither side.
//
// Product names and file names inside the art aren't translated; the two
// captions that are come in as copy.

// Palette — the site's tokens, restated as hexes an SVG attribute can take.
const INK = "#191c22";
const MUT = "#4d5c73";
// Hairline strokes and box outlines. Not a token, and the same value as the
// Hermes art: the one stroke here that has to be lighter than `muted` and still
// hold its shape, set to clear the 3:1 a non-text element needs (3.12:1).
const LINE = "#7d8899";
const BOX = "#edeff3"; // fill for a box on the paper canvas
const KEY = "#12509e"; // the blue — our agent, and only ours
const PAPER = "#ffffff"; // a card on the board, and a glyph on a filled block

// Motion. It carries the argument and nothing else: dashes march along what is
// being handed over, read, or dispatched; a card steps across our board; a
// status light blinks on each of their agents. All of it is off under
// `prefers-reduced-motion`, and both drawings say the same thing standing still.
//
// It lives in the SVG rather than in `globals.css`, which is tokens only, and
// rather than in a Tailwind class, which can't declare keyframes. Both diagrams
// render the same block; the rules are identical, so the second one is a no-op.
const MOTION = `
@keyframes vsm-march { to { stroke-dashoffset: -7 } }
@keyframes vsm-step {
  0%, 16% { transform: translateX(0); opacity: 1 }
  30%, 46% { transform: translateX(38px); opacity: 1 }
  60%, 88% { transform: translateX(76px); opacity: 1 }
  98%, 100% { transform: translateX(76px); opacity: 0 }
}
@keyframes vsm-blip { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: no-preference) {
  .vsm-march { animation: vsm-march 1s linear infinite }
  .vsm-step { animation: vsm-step 3.4s ease-in-out infinite }
  .vsm-blip { animation: vsm-blip 1.8s ease-in-out infinite }
}
`;

// The one figure both drawings share, in the same place in each.
function Person() {
  return (
    <g>
      <circle cx="40" cy="52" r="11.5" fill={BOX} stroke={MUT} strokeWidth="1.4" />
      <circle cx="40" cy="48.4" r="3.4" fill={MUT} />
      <path d="M33.2 60.4 a7 7 0 0 1 13.6 0 z" fill={MUT} />
    </g>
  );
}

// A head on a short line: the arrow ends the art draws by hand, since there is
// one shape and a marker definition would cost more than it saves.
function Head({ x, y = 52 }: { x: number; y?: number }) {
  return (
    <path
      d={`M${x} ${y - 3} l4 3 l-4 3`}
      fill="none"
      stroke={LINE}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// The hand-off from the person into the product: the same dashed run on both
// sides, ending at the same x.
function Handoff() {
  return (
    <>
      <path
        className="vsm-march"
        d="M56 52 H72"
        fill="none"
        stroke={LINE}
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      <Head x={72} />
    </>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-border bg-elev p-2.5">
      {children}
    </div>
  );
}

// Ours: you point, one agent plans against the memory it keeps, and the board
// is what moves.
export function KanbanHeroDiagram({ c }: { c: VsMulticaCopy["hero"] }) {
  return (
    <Frame>
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label={c.oursDiagramAlt}
      >
        <style>{MOTION}</style>
        <text x="24" y="13" fontSize="9" fill={KEY}>
          {c.oursDiagramTop}
        </text>

        <Person />
        <Handoff />

        {/* us: the block is our own mark — the azure fill and the three board
            columns `LogoMark` draws, at the proportions it uses */}
        <rect x="78" y="36" width="52" height="32" rx="8" fill={KEY} />
        <g transform="translate(94 42) scale(0.3333)" fill={PAPER}>
          <rect x="5" y="8" width="12" height="44" rx="3.5" />
          <rect x="24" y="8" width="12" height="35" rx="3.5" />
          <rect x="43" y="8" width="12" height="26" rx="3.5" />
        </g>

        {/* memory, read on the way in and written on the way out */}
        <g fill="none" stroke={LINE} strokeWidth="1.3" strokeDasharray="4 3">
          <path className="vsm-march" d="M99 69 V79" />
          <path className="vsm-march" d="M109 79 V69" />
        </g>
        <path
          d="M96 76 l3 3 l3 -3 M106 72 l3 -3 l3 3"
          fill="none"
          stroke={LINE}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="76"
          y="82"
          width="56"
          height="16"
          rx="4"
          fill={BOX}
          stroke={LINE}
          strokeWidth="1.2"
        />
        <text x="104" y="93.2" textAnchor="middle" fontSize="8" fill={MUT}>
          memory/
        </text>

        {/* agent → board */}
        <path d="M134 52 H150" fill="none" stroke={LINE} strokeWidth="1.4" />
        <Head x={150} />

        {/* the board: three columns, and a card crossing them */}
        <rect
          x="156"
          y="29"
          width="120"
          height="46"
          rx="6"
          fill={PAPER}
          stroke={MUT}
          strokeWidth="1.4"
        />
        {[161, 199, 237].map((x) => (
          <g key={x}>
            <rect x={x} y="34" width="34" height="36" rx="4" fill={BOX} />
            <rect x={x + 4} y="38" width="13" height="2.5" rx="1.25" fill={LINE} />
            <rect
              x={x + 4}
              y="45"
              width="26"
              height="7"
              rx="2"
              fill={PAPER}
              stroke={MUT}
              strokeWidth="1"
            />
          </g>
        ))}
        <rect
          className="vsm-step"
          x="165"
          y="56"
          width="26"
          height="7"
          rx="2"
          fill={PAPER}
          stroke={KEY}
          strokeWidth="1.4"
        />

        <text x="24" y="115" fontSize="9" fill={MUT}>
          {c.oursDiagramBottom}
        </text>
      </svg>
    </Frame>
  );
}

// Theirs: you configure a fleet — each agent with its own skills and runtime —
// and the console is what you work.
export function MulticaHeroDiagram({ c }: { c: VsMulticaCopy["hero"] }) {
  return (
    <Frame>
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label={c.theirsDiagramAlt}
      >
        <style>{MOTION}</style>
        <text x="24" y="13" fontSize="9" fill={INK}>
          {c.theirsDiagramTop}
        </text>

        {/* Everything below hangs 12 lower than it is drawn. Our side has the
            memory chip under the block and so fills the frame down to the
            caption; theirs has nothing there, and left on the same line it
            floated at the top of its panel. The offset is on the group rather
            than on each y, so the coordinates still mirror the other drawing's. */}
        <g transform="translate(0 12)">
          <Person />
          <Handoff />

          {/* them: their own mark, the star from `public/multica-logo.svg`, on
              the ink block that stands for Multica everywhere on this page */}
          <rect x="78" y="36" width="52" height="32" rx="8" fill={INK} />
          <polygon
            transform="translate(95 43) scale(0.18)"
            fill={PAPER}
            points="45,62.1 45,100 55,100 55,62.1 81.8,88.9 88.9,81.8 62.1,55 100,55 100,45 62.1,45 88.9,18.2 81.8,11.1 55,37.9 55,0 45,0 45,37.9 18.2,11.1 11.1,18.2 37.9,45 0,45 0,55 37.9,55 11.1,81.8 18.2,88.9"
          />

          {/* dispatched out to the fleet, down a bus rather than a fan: three
              lines leaving one point read as an arrowhead pointing back at it */}
          <path d="M142 28 V76" fill="none" stroke={LINE} strokeWidth="1.3" />
          <g fill="none" stroke={LINE} strokeWidth="1.3" strokeDasharray="4 3">
            <path className="vsm-march" d="M134 52 H142" />
            <path className="vsm-march" d="M142 28 H158" />
            <path className="vsm-march" d="M142 52 H158" />
            <path className="vsm-march" d="M142 76 H158" />
          </g>
          <Head x={158} y={28} />
          <Head x={158} />
          <Head x={158} y={76} />

          {/* each agent: its own responsibilities, skills and runtime, and a
              light you watch it by */}
          {[19.5, 43.5, 67.5].map((y, index) => (
            <g key={y}>
              <rect
                x="164"
                y={y}
                width="112"
                height="17"
                rx="5"
                fill={BOX}
                stroke={LINE}
                strokeWidth="1.2"
              />
              <circle cx="174" cy={y + 8.5} r="3.2" fill={MUT} />
              {[184, 218].map((x) => (
                <rect
                  key={x}
                  x={x}
                  y={y + 5}
                  width="30"
                  height="7"
                  rx="2"
                  fill={PAPER}
                  stroke={LINE}
                  strokeWidth="1"
                />
              ))}
              <circle
                className="vsm-blip"
                style={{ animationDelay: `${index * 0.6}s` }}
                cx="266"
                cy={y + 8.5}
                r="2.8"
                fill={MUT}
              />
            </g>
          ))}
        </g>

        <text x="24" y="115" fontSize="9" fill={MUT}>
          {c.theirsDiagramBottom}
        </text>
      </svg>
    </Frame>
  );
}
