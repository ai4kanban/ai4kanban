import {
  BottomCaption,
  BOX,
  Head,
  INK,
  KEY,
  LINE,
  March,
  MUT,
  OursBlock,
  PAPER,
  Person,
  TheirsBlock,
  TopCaption,
  VsDiagram,
} from "@/components/vs/diagram";
import type { VsLinearCopy } from "@/i18n/vs-linear/types";

// Both drawings are three things: what goes in, the product, what comes out.
// Nothing else, because the only question this page answers is what each tool
// is *for*, and a fourth object would be the reader's problem rather than the
// argument's.
//
// Ours: a vague idea in, a spec you can build out.
// Theirs: a team in, one shared list of who is doing what out.

// Ours: turn a vague idea into a spec you can build.
export function KanbanHeroDiagram({ c }: { c: VsLinearCopy["hero"] }) {
  return (
    <VsDiagram alt={c.oursDiagramAlt}>
      <TopCaption ours>{c.oursDiagramTop}</TopCaption>

      {/* in: a note with two loose lines and no edges — literally not finished */}
      <rect
        x="24"
        y="40"
        width="46"
        height="32"
        rx="4"
        fill={BOX}
        stroke={LINE}
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
      <rect x="32" y="49" width="30" height="3" rx="1.5" fill={LINE} />
      <rect x="32" y="57" width="18" height="3" rx="1.5" fill={LINE} />

      <March d="M74 56 H86" w={1.3} />
      <Head x={86} y={56} />

      <OursBlock x={100} y={38} />

      <March d="M140 56 H160" w={1.3} />
      <Head x={160} y={56} />

      {/* out: a title and, under it, what "done" has to mean — the thing the
          note didn't have and the only reason to run it through anything */}
      <rect
        x="166"
        y="28"
        width="110"
        height="56"
        rx="5"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      <rect x="176" y="38" width="52" height="4" rx="2" fill={KEY} />
      {[52, 64].map((y) => (
        <g key={y}>
          <path
            d={`M177 ${y} l2.6 2.6 l5 -5.4`}
            fill="none"
            stroke={KEY}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="189" y={y - 1.5} width="77" height="3" rx="1.5" fill={LINE} />
        </g>
      ))}

      <BottomCaption>{c.oursDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}

// Theirs: keep a whole team's work in one place — who has what, and where it
// stands.
export function LinearHeroDiagram({ c }: { c: VsLinearCopy["hero"] }) {
  return (
    <VsDiagram alt={c.theirsDiagramAlt}>
      <TopCaption>{c.theirsDiagramTop}</TopCaption>

      {/* in: a team. Three, because three is the smallest number that reads as
          "more than you", and our side has exactly none. */}
      {[36, 56, 76].map((cy) => (
        <Person key={cy} cx={38} cy={cy} s={0.62} />
      ))}
      <March d="M52 56 H86" w={1.3} />
      <Head x={86} y={56} />

      {/* them: the half-filled square this page uses as Linear's tag */}
      <TheirsBlock x={100} y={38}>
        <rect
          x="110"
          y="48"
          width="16"
          height="16"
          rx="2.5"
          fill="none"
          stroke={INK}
          strokeWidth="1.6"
        />
        <rect x="111.2" y="49.2" width="6.8" height="13.6" rx="1.4" fill={INK} />
      </TheirsBlock>

      <March d="M140 56 H160" w={1.3} />
      <Head x={160} y={56} />

      {/* out: one list, and every row says who owns it and where it stands */}
      <rect
        x="166"
        y="26"
        width="110"
        height="60"
        rx="5"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {[36, 52, 68].map((y, i) => (
        <g key={y}>
          <Person cx={178} cy={y} s={0.36} />
          <rect x="188" y={y - 1.5} width={[58, 72, 48][i]} height="3" rx="1.5" fill={LINE} />
          <rect
            x="252"
            y={y - 3.5}
            width="14"
            height="7"
            rx="3.5"
            fill={BOX}
            stroke={LINE}
            strokeWidth="1"
          />
        </g>
      ))}

      <BottomCaption>{c.theirsDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}
