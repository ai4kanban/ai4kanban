import { ACCENT, Bot, Figure, INK, Kid, MUTED, Sketch } from "./kit";

const CAPTION = "The agent asks first, settles what it can, and hands you the few real choices.";

const line = { fill: "none", stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const };

// Before building, the agent clears up most questions itself and hands the person one choice.
export function AskingFirst() {
  return (
    <Figure caption={CAPTION}>
      <svg viewBox="0 0 640 340" className="block w-full" role="img" aria-label={CAPTION}>
        <rect width={640} height={340} fill="#fff" />
        <Sketch id="sk-asking">
          {/* idea card */}
          <rect {...line} fill="#fff" x={36} y={40} width={150} height={92} rx={8} />
          <path {...line} stroke={MUTED} strokeWidth={6} d="M56 66 L150 66 M56 88 L130 88 M56 110 L110 110" />
          <path {...line} d="M196 86 Q220 86 234 100" />
          <path {...line} d="M226 94 L236 102 L226 108" />

          {/* the agent and the questions it settles alone */}
          <Bot x={300} y={210} />
          {[
            [250, 70],
            [300, 44],
            [352, 68],
          ].map(([cx, cy]) => (
            <g key={`${cx}`}>
              <circle {...line} fill="#fff" cx={cx} cy={cy} r={18} />
              <path {...line} stroke={ACCENT} d={`M${cx - 8} ${cy} L${cx - 2} ${cy + 7} L${cx + 9} ${cy - 7}`} />
            </g>
          ))}
          <circle {...line} fill="#fff" cx={300} cy={110} r={18} />
          <text x={300} y={119} textAnchor="middle" fontSize={26} fontWeight={700} fill={INK}>?</text>

          {/* the one question that comes back */}
          <path {...line} d="M340 196 Q370 170 396 176" />
          <rect {...line} fill="#fff" x={396} y={120} width={104} height={112} rx={8} />
          <text x={414} y={150} fontSize={18} fontWeight={700} fill={INK}>?</text>
          {["A", "B", "C"].map((l, i) => (
            <g key={l}>
              <rect {...line} strokeWidth={2.5} fill={l === "B" ? ACCENT : "#fff"} x={414} y={162 + i * 22} width={14} height={14} rx={3} />
              <path {...line} stroke={MUTED} strokeWidth={5} d={`M438 ${169 + i * 22} L${l === "B" ? 484 : 474} ${169 + i * 22}`} />
            </g>
          ))}

          <Kid x={584} y={180} arm="left" />
          <path stroke={INK} strokeWidth={2} d="M20 332 L620 332" opacity={0.25} />
        </Sketch>
      </svg>
    </Figure>
  );
}
