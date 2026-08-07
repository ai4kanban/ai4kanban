import type { VsHermesCopy } from "@/i18n/vs-hermes-kanban/types";

// Two SVG diagrams that show the *layering*, which is the real difference.
// Skill: the kanban is only the bottom coordination layer — plain Markdown —
// and the runtime (Claude Code / Cursor / Hermes), execution, and maintenance
// are a task layer stacked on top, swappable. Hermes: the board is fused inside
// one Hermes runtime with its dispatcher and agents.
//
// Both are drawn on a paper island, with the boxes inside it in the wash, so the
// layers read against the inset panel behind them. Neither drawing carries a
// frame of its own: the card and the diagram well already draw two, and a third
// outline around the art reads as a box in a box. The blue only ever marks *our*
// side of the argument — the board layer below.
//
// Product names, agent names and file names inside the art aren't translated;
// the two sentences that are (the layer captions) come in as copy.

// Palette — the site's tokens, restated as hexes an SVG attribute can take.
const INK = "#191c22";
const MUT = "#4d5c73";
// Hairline strokes and box outlines. Not a token: it is the one value here that
// has to be lighter than `muted` and still hold its shape, so it is set to clear
// the 3:1 a non-text element needs against the wash it is drawn on (3.12:1).
const LINE = "#7d8899";
const BOX = "#edeff3"; // fill for a box on the paper canvas
const KEY = "#12509e"; // the blue — our layer, and only ours

// Skill: a swappable runtime layered on top of a plain-Markdown board.
export function SkillDiagram({ c }: { c: VsHermesCopy["hero"] }) {
  const runtimes = [
    { x: 24, label: "Claude Code" },
    { x: 112, label: "Cursor" },
    { x: 200, label: "Hermes" },
  ];
  return (
    <div className="rounded-xl border-2 border-border bg-elev p-2.5">
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label={c.oursDiagramAlt}
      >
        {/* top: pluggable runtimes / agents */}
        {runtimes.map((r) => (
          <g key={r.label}>
            <rect x={r.x} y="10" width="76" height="22" rx="7" fill={BOX} stroke={LINE} strokeWidth="1.5" />
            <text x={r.x + 38} y="24.5" textAnchor="middle" fontSize="8.5" fill={INK}>
              {r.label}
            </text>
            {/* plugs down onto the task layer */}
            <path d={`M${r.x + 38} 32 V48`} stroke={LINE} strokeWidth="1.4" strokeDasharray="2 2.5" />
          </g>
        ))}

        {/* middle: the task layer where work + maintenance run */}
        <rect x="24" y="48" width="252" height="24" rx="6" fill={BOX} stroke={LINE} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="150" y="63.5" textAnchor="middle" fontSize="8.5" fill={MUT}>
          {c.taskLayer}
        </text>

        {/* bottom: the kanban board — plain Markdown files in git */}
        <rect x="24" y="84" width="252" height="30" rx="6" fill={BOX} stroke={KEY} strokeWidth="1.8" />
        {[34, 47, 60].map((x) => (
          <rect key={x} x={x} y="91" width="9" height="16" rx="1.5" fill="none" stroke={LINE} strokeWidth="1.2" />
        ))}
        <text x="164" y="102.5" textAnchor="middle" fontSize="8.5" fill={KEY}>
          {c.boardLayer}
        </text>
      </svg>
    </div>
  );
}

// Hermes: the board is fused into one integrated runtime alongside its
// dispatcher and named agents.
export function HermesDiagram({ c }: { c: VsHermesCopy["hero"] }) {
  const agents: { y: number; name: string; dot: string }[] = [
    { y: 42, name: "eng", dot: "#7f56b8" },
    { y: 66, name: "review", dot: "#bf8700" },
    { y: 90, name: "ops", dot: "#1a7f37" },
  ];
  return (
    <div className="rounded-xl border-2 border-border bg-elev p-2.5">
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label={c.theirsDiagramAlt}
      >
        {/* the single integrated runtime — named, not boxed: everything below
            sits inside it, and an outline here would be the third one in a row.
            The parts are laid out to the same margins as the skill diagram, so
            the pair reads as two drawings of the same size. */}
        <text x="24" y="20" fontSize="9" fill={INK}>{c.runtimeLabel}</text>

        {/* wiring — tightly coupled, all inside the runtime */}
        <g stroke={LINE} strokeWidth="1.4" fill="none">
          <path d="M68 76 H100" />
          <path d="M162 76 L190 52" />
          <path d="M162 76 H190" />
          <path d="M162 76 L190 100" />
        </g>

        {/* board (SQLite) */}
        <path d="M24 62 V88 A22 6 0 0 0 68 88 V62" fill={BOX} stroke={MUT} strokeWidth="1.4" />
        <ellipse cx="46" cy="62" rx="22" ry="6" fill={BOX} stroke={MUT} strokeWidth="1.4" />
        <text x="46" y="106" textAnchor="middle" fontSize="8.5" fill={MUT}>kanban.db</text>

        {/* dispatcher */}
        <rect x="100" y="62" width="62" height="28" rx="5" fill={BOX} stroke={LINE} strokeWidth="1.4" />
        <text x="131" y="79" textAnchor="middle" fontSize="8.5" fill={INK}>dispatcher</text>

        {/* named agents */}
        {agents.map((a) => (
          <g key={a.name}>
            <rect x="190" y={a.y} width="86" height="20" rx="5" fill={BOX} stroke={LINE} strokeWidth="1.4" />
            <circle cx="203" cy={a.y + 10} r="4.5" fill={a.dot} />
            <text x="214" y={a.y + 13.5} fontSize="8.5" fill={INK}>{a.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
