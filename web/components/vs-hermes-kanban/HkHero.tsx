import { panelStatic } from "../styles";
import { HermesMark } from "./HermesMark";

// Two SVG diagrams that show the *layering*, which is the real difference.
// Skill: the kanban is only the bottom coordination layer — plain Markdown —
// and the runtime (Claude Code / Cursor / Hermes), execution, and maintenance
// are a task layer stacked on top, swappable. Hermes: the board is fused inside
// one Hermes runtime with its dispatcher and agents. Palette is the site's
// GitHub-dark scheme so the art reads on the bg-code chips.

// Skill: a swappable runtime layered on top of a plain-Markdown board.
// Drawn light-on-light inside a pale canvas so it reads on the dark chip.
function SkillDiagram() {
  const runtimes = [
    { x: 24, label: "Claude Code" },
    { x: 112, label: "Cursor" },
    { x: 200, label: "Hermes" },
  ];
  return (
    <div className="mb-4 rounded-lg border border-[#d0d7de] bg-[#eaeef2] p-2.5">
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label="The kanban is a Markdown board at the bottom; the agent runtime, execution and maintenance are a swappable layer stacked on top."
      >
        {/* top: pluggable runtimes / agents */}
        {runtimes.map((r) => (
          <g key={r.label}>
            <rect x={r.x} y="10" width="76" height="22" rx="7" fill="#ffffff" stroke="#8c959f" strokeWidth="1.5" />
            <text x={r.x + 38} y="24.5" textAnchor="middle" fontSize="8.5" fill="#1f2328">
              {r.label}
            </text>
            {/* plugs down onto the task layer */}
            <path d={`M${r.x + 38} 32 V48`} stroke="#8c959f" strokeWidth="1.4" strokeDasharray="2 2.5" />
          </g>
        ))}

        {/* middle: the task layer where work + maintenance run */}
        <rect x="24" y="48" width="252" height="24" rx="6" fill="#f6f8fa" stroke="#8c959f" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="150" y="63.5" textAnchor="middle" fontSize="8.5" fill="#59636e">
          task layer · execution + maintenance
        </text>

        {/* bottom: the kanban board — plain Markdown files in git */}
        <rect x="24" y="84" width="252" height="30" rx="6" fill="#ffffff" stroke="#0969da" strokeWidth="1.8" />
        {[34, 47, 60].map((x) => (
          <rect key={x} x={x} y="91" width="9" height="16" rx="1.5" fill="none" stroke="#8c959f" strokeWidth="1.2" />
        ))}
        <text x="164" y="102.5" textAnchor="middle" fontSize="8.5" fill="#0969da">
          kanban · Markdown files (git)
        </text>
      </svg>
    </div>
  );
}

// Hermes: the board is fused into one integrated runtime alongside its
// dispatcher and named agents.
function HermesDiagram() {
  const agents: { y: number; name: string; dot: string }[] = [
    { y: 40, name: "eng", dot: "#0969da" },
    { y: 62, name: "review", dot: "#bf8700" },
    { y: 84, name: "ops", dot: "#1a7f37" },
  ];
  return (
    <div className="mb-4 rounded-lg border border-[#d0d7de] bg-[#eaeef2] p-2.5">
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label="One integrated Hermes runtime with the SQLite board, dispatcher and named agents fused inside it."
      >
        {/* the single integrated runtime */}
        <rect x="18" y="10" width="264" height="104" rx="11" fill="#ffffff" stroke="#0969da" strokeWidth="1.8" />
        <text x="32" y="26" fontSize="9" fill="#0969da">Hermes runtime</text>

        {/* wiring — tightly coupled, all inside the box */}
        <g stroke="#8c959f" strokeWidth="1.4" fill="none">
          <path d="M92 66 H110" />
          <path d="M164 66 L188 49" />
          <path d="M164 66 L188 71" />
          <path d="M164 66 L188 93" />
        </g>

        {/* board (SQLite) */}
        <path d="M48 56 V76 A22 6 0 0 0 92 76 V56" fill="#f6f8fa" stroke="#59636e" strokeWidth="1.4" />
        <ellipse cx="70" cy="56" rx="22" ry="6" fill="#f6f8fa" stroke="#59636e" strokeWidth="1.4" />
        <text x="70" y="98" textAnchor="middle" fontSize="8" fill="#59636e">kanban.db</text>

        {/* dispatcher */}
        <rect x="110" y="52" width="54" height="28" rx="5" fill="#f6f8fa" stroke="#8c959f" strokeWidth="1.4" />
        <text x="137" y="69" textAnchor="middle" fontSize="8" fill="#1f2328">dispatcher</text>

        {/* named agents */}
        {agents.map((a) => (
          <g key={a.name}>
            <rect x="188" y={a.y} width="76" height="18" rx="5" fill="#f6f8fa" stroke="#8c959f" strokeWidth="1.4" />
            <circle cx="200" cy={a.y + 9} r="4" fill={a.dot} />
            <text x="210" y={a.y + 12} fontSize="8" fill="#1f2328">{a.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// A compact two-chip header that states the framing before any detail: the same
// board idea two ways — a lean board layer vs. a runtime that owns the board.
export function HkHero() {
  return (
    <section className="mt-12 text-center">
      <p className="mb-5 inline-block rounded-full bg-accent/10 px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-accent">
        Comparison
      </p>
      <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
        AI4Kanban vs.
        <br />
        Hermes Agent Kanban
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
        Two agent-facing kanban boards with a lot of overlap. The difference is
        where the board sits in the stack: ai4kanban is a lean{" "}
        <em>board layer</em> you run any agent on top of; Hermes Agent Kanban
        fuses that board into its own runtime.
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3 text-left sm:flex-row">
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <SkillDiagram />
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🗂️
            </span>
            <span className="font-semibold text-ink">AI4Kanban</span>
          </div>
          <p className="text-sm text-muted">
            A plain-Markdown board in your repo. The runtime, execution, and even
            maintenance layer on top — swap the agent, keep the board.
          </p>
        </div>
        <div className="hidden items-center justify-center px-1 font-mono text-sm font-semibold text-muted sm:flex">
          vs
        </div>
        <div className={`${panelStatic} flex-1 bg-code p-5`}>
          <HermesDiagram />
          <div className="mb-1.5 flex items-center gap-2">
            <HermesMark className="h-5 w-5" />
            <span className="font-semibold text-ink">Hermes Agent Kanban</span>
          </div>
          <p className="text-sm text-muted">
            The board, dispatcher, and named agents are one integrated runtime —
            durable and bundled, but the board doesn&apos;t detach from Hermes.
          </p>
        </div>
      </div>
    </section>
  );
}
