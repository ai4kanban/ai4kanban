import { FiCheck, FiDatabase, FiUser } from "react-icons/fi";
import { Figure, Panel } from "./kit";

const HEIGHT = 190;
const ROWS = Array.from({ length: 9 }, (_, index) => index);

function Questions({ resolved }: { resolved: boolean }) {
  return (
    <g>
      {ROWS.map((row) => {
        const y = 18 + row * 18;
        const needsHuman = resolved && row === 7;
        return (
          <g key={row}>
            <circle
              cx={30}
              cy={y}
              r={6}
              className={needsHuman ? "fill-accent" : "fill-code"}
            />
            {resolved && !needsHuman && (
              <FiCheck x={26} y={y - 4} size={8} color="var(--color-growth)" aria-hidden="true" />
            )}
            <rect
              x={44}
              y={y - 3}
              width={row % 3 === 0 ? 98 : row % 2 === 0 ? 76 : 112}
              height={6}
              rx={3}
              className="fill-border"
              opacity={needsHuman ? 0.34 : 0.15}
            />
          </g>
        );
      })}
    </g>
  );
}

export function DecisionCompression() {
  return (
    <Figure
      wash="mintSky"
      caption="A task may contain many product questions. Project memory lets the agent settle routine ones and package the exceptional decision with context and a recommendation."
    >
      <Panel
        title="Every question reaches the person"
        alt="Nine product questions presented directly for human attention"
        height={HEIGHT}
      >
        <Questions resolved={false} />
        <circle cx={244} cy={94} r={22} className="fill-code stroke-muted" />
        <FiUser x={234} y={84} size={20} color="var(--color-muted)" aria-hidden="true" />
      </Panel>
      <Panel
        title="One decision reaches the person"
        alt="Eight routine product questions resolved from memory and one highlighted question sent to a person"
        height={HEIGHT}
      >
        <Questions resolved />
        <circle cx={194} cy={94} r={20} className="fill-code stroke-muted" />
        <FiDatabase x={185} y={85} size={18} color="var(--color-accent-deep)" aria-hidden="true" />
        <path d="M158 144 C185 144 182 112 194 112" className="stroke-muted" fill="none" strokeWidth={1.2} strokeDasharray="4 3" />
        <path d="M214 94 H238" className="stroke-muted" fill="none" strokeWidth={1.2} strokeDasharray="4 3" />
        <circle cx={260} cy={94} r={18} className="fill-code stroke-muted" />
        <FiUser x={252} y={86} size={16} color="var(--color-muted)" aria-hidden="true" />
      </Panel>
    </Figure>
  );
}
