import { FaGithub } from "react-icons/fa";
import {
  BottomCaption,
  BOX,
  Head,
  INK,
  KEY,
  LINE,
  March,
  MUT,
  PAPER,
  Person,
  Robot,
  TopCaption,
  VsDiagram,
} from "@/components/vs/diagram";
import type { VsGithubCopy } from "@/i18n/vs-github-issues/types";

// Count the windows.
//
// Every earlier draft of this pair drew the argument in shapes — a bar for
// code, three columns for a board, a dashed line for a network — and a reader
// had to decode all three before the comparison meant anything. So this one
// draws the two things a developer already recognises without being told: a
// file tree, and a browser with a URL in it.
//
// Ours is one window. `docs/kanban/` is a folder next to `src/`, and the task
// is a file open in the same editor as the code.
// Theirs is two: your files in one, and `github.com` in the other, because the
// task is a page on a site rather than a path in the repo.
//
// Both drawings put their figure in the same place on the left with an arrow
// per window, so the count of arrows says the same thing the count of windows
// does. That is the whole argument, and neither drawing needs its caption to
// land it.
//
// This is the one pair with no product block. The hero chip above each drawing
// already carries the name and the mark, and windows this size need the width
// — so GitHub's identity rides in the URL, which is where the claim lives.

const MONO = "var(--font-mono)";

// A filename, a path, or a URL — anything a reader is meant to read as text
// they could have typed. Mono, because that is what makes it read as a path
// rather than as a label.
function Path({
  x,
  y,
  size = 7,
  fill = LINE,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  fill?: string;
  children: string;
}) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={MONO} fill={fill} xmlSpace="preserve">
      {children}
    </text>
  );
}

// The three dots that make a rectangle read as a window rather than a card.
function Chrome({ x, y }: { x: number; y: number }) {
  return (
    <>
      {[0, 7, 14].map((d) => (
        <circle key={d} cx={x + d} cy={y} r="1.7" fill={LINE} />
      ))}
    </>
  );
}

function Window({
  x,
  y,
  w,
  h,
  bar,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  bar: number; // where the title bar ends
  children: React.ReactNode;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      <Chrome x={x + 8} y={(y + bar) / 2} />
      <path d={`M${x} ${bar} H${x + w}`} fill="none" stroke={MUT} strokeWidth="1" />
      {children}
    </>
  );
}

// Ours: one window. The board is a folder in the tree, and the task is a file.
export function KanbanHeroDiagram({ c }: { c: VsGithubCopy["hero"] }) {
  return (
    <VsDiagram alt={c.oursDiagramAlt}>
      <TopCaption ours>{c.oursDiagramTop}</TopCaption>

      <Robot cx={34} cy={62} s={1.9} />
      {/* one arrow, because there is one place to go */}
      <March d="M48 62 H68" w={1.3} />
      <Head x={68} y={62} />

      <Window x={72} y={22} w={204} h={80} bar={36}>
        {/* the sidebar, and the only claim that matters: docs/kanban/ is a
            sibling of src/, not a website */}
        <Path x={80} y={50} fill={MUT}>
          src/
        </Path>
        <Path x={80} y={62}>
          {"  app.ts"}
        </Path>
        <Path x={80} y={74} fill={MUT}>
          docs/kanban/
        </Path>
        <Path x={80} y={86} fill={KEY}>
          {"  12-fix-login.md"}
        </Path>

        <path d="M166 36 V102" fill="none" stroke={MUT} strokeWidth="1" />

        {/* and the task itself, open in the same window as the code */}
        <Path x={176} y={54} size={7.5} fill={KEY}>
          # Fix login
        </Path>
        <Path x={176} y={70} size={6.8}>
          - [x] repro the bug
        </Path>
        <Path x={176} y={82} size={6.8}>
          - [ ] patch handler
        </Path>
      </Window>

      <BottomCaption>{c.oursDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}

// Theirs: two windows. Your files in one, a site in the other.
export function GithubHeroDiagram({ c }: { c: VsGithubCopy["hero"] }) {
  const issues = [
    { y: 89, id: "#14", title: "Fix login" },
    { y: 99, id: "#13", title: "Add search" },
  ];

  return (
    <VsDiagram alt={c.theirsDiagramAlt}>
      <TopCaption>{c.theirsDiagramTop}</TopCaption>

      <Person cx={34} cy={62} s={0.9} />
      {/* the same one arrow, and then it has to fork — there are two places */}
      <March d="M48 62 H60" w={1.3} />
      <path d="M60 44 V84" fill="none" stroke={LINE} strokeWidth="1.3" />
      <March d="M60 44 H68" w={1.3} />
      <Head x={68} y={44} />
      <March d="M60 84 H68" w={1.3} />
      <Head x={68} y={84} />

      {/* window one: your files, and no board among them */}
      <Window x={72} y={22} w={104} h={36} bar={35}>
        <Path x={80} y={45} fill={MUT}>
          src/
        </Path>
        <Path x={80} y={55}>
          {"  app.ts"}
        </Path>
      </Window>

      {/* window two: a URL, which is the whole difference */}
      <Window x={72} y={66} w={204} h={36} bar={80}>
        <rect x="104" y="68" width="122" height="10" rx="5" fill={BOX} />
        <FaGithub x={108} y={69.5} size={7} color={INK} />
        <Path x={118} y={75.5} size={6.2} fill={MUT}>
          github.com/you/repo/issues
        </Path>

        {issues.map(({ y, id, title }) => (
          <g key={id}>
            <circle
              cx="86"
              cy={y - 2.3}
              r="2.6"
              fill="none"
              stroke={LINE}
              strokeWidth="1"
            />
            <circle cx="86" cy={y - 2.3} r="0.9" fill={LINE} />
            <Path x={94} y={y} size={6.8}>
              {`${id}  ${title}`}
            </Path>
            <rect
              x="238"
              y={y - 7}
              width="26"
              height="9"
              rx="4.5"
              fill={BOX}
              stroke={LINE}
              strokeWidth="0.8"
            />
            <Path x={243} y={y - 0.5} size={5.6} fill={MUT}>
              open
            </Path>
          </g>
        ))}
      </Window>

      <BottomCaption>{c.theirsDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}
