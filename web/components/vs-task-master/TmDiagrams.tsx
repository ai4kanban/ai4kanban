import {
  BottomCaption,
  BOX,
  BrandImage,
  Head,
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
import type { VsTaskMasterCopy } from "@/i18n/vs-task-master/types";

// Both drawings are the same three objects — what goes in, the product, what
// comes back — so the only thing left to compare is the first one.
//
// Theirs: a finished document goes in, and numbered tasks come back. Ours: one
// unfinished line goes in, and the arrow bends up to a person and back before
// anything comes out. That bend is the page's whole argument, so it is the only
// thing in either drawing that isn't in both.

// Ours: a line, a question back to you, then a card that is actually specific.
export function KanbanHeroDiagram({ c }: { c: VsTaskMasterCopy["hero"] }) {
  return (
    <VsDiagram alt={c.oursDiagramAlt}>
      <TopCaption ours>{c.oursDiagramTop}</TopCaption>

      {/* in: one short line on a torn scrap — a sentence, not a document */}
      <rect
        x="24"
        y="46"
        width="42"
        height="22"
        rx="4"
        fill={BOX}
        stroke={LINE}
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
      <rect x="31" y="56" width="24" height="3" rx="1.5" fill={LINE} />

      <March d="M70 57 H82" w={1.3} />
      <Head x={82} y={57} />

      <OursBlock x={96} y={39} />

      {/* the loop, and the only thing in this pair the other drawing has no
          answer to: the block asks you something, and the answer goes back into
          the block — not into the card. It sits above the flow so the line from
          scrap to card stays a straight read underneath it. */}
      <Person cx={114} cy={22} s={0.55} />
      <March d="M108 38 V33" w={1.2} />
      <Head x={108} y={33} dir="up" />
      <March d="M120 29 V35" w={1.2} />
      <Head x={120} y={35} dir="down" />
      <text x="98" y="31" fontSize="9" fill={KEY}>
        ?
      </text>

      <March d="M136 57 H160" w={1.3} />
      <Head x={160} y={57} />

      {/* out: a title, and under it what "done" has to mean — the part the
          scrap never had, and the only reason to run it through anything */}
      <rect
        x="166"
        y="34"
        width="110"
        height="46"
        rx="5"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      <rect x="176" y="42" width="50" height="4" rx="2" fill={KEY} />
      {[56, 68].map((y) => (
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

// Theirs: the document you already wrote, split into numbered tasks in order.
export function TaskMasterHeroDiagram({ c }: { c: VsTaskMasterCopy["hero"] }) {
  return (
    <VsDiagram alt={c.theirsDiagramAlt}>
      <TopCaption>{c.theirsDiagramTop}</TopCaption>

      {/* in: a full page, every line written, hard edges — the work you did
          before you got here. Ours is one line on a dashed scrap at the same
          spot, and that is the pair's one real difference. */}
      <rect
        x="24"
        y="34"
        width="42"
        height="46"
        rx="4"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {[42, 49, 56, 63, 70].map((y, i) => (
        <rect
          key={y}
          x="31"
          y={y}
          width={[28, 24, 28, 26, 16][i]}
          height="3"
          rx="1.5"
          fill={LINE}
        />
      ))}

      <March d="M70 57 H82" w={1.3} />
      <Head x={82} y={57} />

      <TheirsBlock x={96} y={39}>
        <BrandImage href="/task-master-logo.svg" cx={114} cy={57} size={19} />
      </TheirsBlock>

      <March d="M136 57 H160" w={1.3} />
      <Head x={160} y={57} />

      {/* out: numbered rows, each one waiting on the one above it — the order
          is the product, so the dependency rail is drawn and not implied */}
      <rect
        x="166"
        y="30"
        width="110"
        height="54"
        rx="5"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      <path
        d="M180 42 V72"
        fill="none"
        stroke={LINE}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {[42, 57, 72].map((y, i) => (
        <g key={y}>
          <circle cx="180" cy={y} r="3.6" fill={PAPER} stroke={MUT} strokeWidth="1.2" />
          <text
            x="180"
            y={y + 2.1}
            fontSize="6"
            fontWeight="600"
            textAnchor="middle"
            fill={MUT}
          >
            {i + 1}
          </text>
          <rect
            x="190"
            y={y - 1.5}
            width={[70, 56, 62][i]}
            height="3"
            rx="1.5"
            fill={LINE}
          />
        </g>
      ))}

      <BottomCaption>{c.theirsDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}
